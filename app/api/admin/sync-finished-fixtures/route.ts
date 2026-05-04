import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { buildMatchFromRaw, type RawFixtureRow } from '@/lib/buildMatchFromRaw'

export const runtime = 'nodejs'

// ── POST /api/admin/sync-finished-fixtures ────────────────────────────────
//
// Sincroniza todos los partidos terminados de una fecha/liga desde API-Football.
// Hace todo en un solo llamado: fetch raw → guarda raw → transforma → persiste.
//
// Body:
//   { "secret": "...", "date": "2026-05-03", "leagueId": 128, "season": 2026 }
//
// Por cada fixture terminado (FT / AET / PEN):
//   1. Llama a /fixtures/events y /fixtures/lineups de API-Football
//   2. Hace upsert del raw en api_football_raw_fixtures
//   3. Transforma con buildMatchFromRaw
//   4. Hace upsert del Match en matches_api
//
// MEJORA FUTURA: API-Football expone `fixture.status.extra` con el tiempo adicional
// del segundo tiempo (y prórroga). Se podría usar `90 + extra` como duración nominal
// extendida en lugar del 90 fijo actual. Por ahora se mantiene la lógica nominal.

// ── Constantes ────────────────────────────────────────────────────────────

const AF_BASE      = 'https://v3.football.api-sports.io'
const FINISHED     = new Set(['FT', 'AET', 'PEN'])

// ── Tipos ─────────────────────────────────────────────────────────────────

type Body = {
  secret:   string
  date:     string    // "YYYY-MM-DD"
  leagueId: number
  season:   number
}

type SyncedMatch = {
  fixtureId: number
  matchId:   string
  home:      string
  away:      string
  status:    'synced' | 'skipped' | 'error'
  error?:    string
}

// ── Helper: llamada a API-Football ────────────────────────────────────────

async function afFetch(path: string, apiKey: string): Promise<unknown> {
  const url = `${AF_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
      'Accept':          'application/json',
    },
    // No cachear — siempre queremos datos frescos
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`API-Football ${path} → HTTP ${res.status}`)
  }

  return res.json()
}

// ── Helper: generar internalMatchId ──────────────────────────────────────
//
// Ejemplo: "Racing Club" + "Huracán" + "2026-05-03" → "racing-club-huracan-2026-05-03"

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')                          // descomponer acentos
    .replace(/[\u0300-\u036f]/g, '')           // eliminar diacríticos
    .replace(/[^a-z0-9\s-]/g, '')             // solo alfanumérico y espacios
    .trim()
    .replace(/\s+/g, '-')                      // espacios → guiones
    .replace(/-+/g, '-')                       // guiones múltiples → uno
}

function buildMatchId(homeName: string, awayName: string, date: string): string {
  return `${slugify(homeName)}-${slugify(awayName)}-${date}`
}

// ── Endpoint ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const syncSecret = process.env.SYNC_SECRET
  const apiKey     = process.env.API_FOOTBALL_KEY

  if (!syncSecret) {
    return NextResponse.json({ error: 'SYNC_SECRET no configurado' }, { status: 500 })
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'API_FOOTBALL_KEY no configurado' }, { status: 500 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (!body.secret || body.secret !== syncSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validar date
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'date requerido en formato YYYY-MM-DD' }, { status: 400 })
  }
  if (!body.leagueId || typeof body.leagueId !== 'number') {
    return NextResponse.json({ error: 'leagueId requerido (number)' }, { status: 400 })
  }
  if (!body.season || typeof body.season !== 'number') {
    return NextResponse.json({ error: 'season requerido (number)' }, { status: 400 })
  }

  // ── Consultar fixtures del día ────────────────────────────────────────
  let fixturesData: any
  try {
    fixturesData = await afFetch(
  `/fixtures?date=${body.date}`,
  apiKey
)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-finished-fixtures] fixtures fetch error:', msg)
    return NextResponse.json({ error: 'Error al consultar API-Football', detail: msg }, { status: 502 })
  }

  const allFixtures: any[] = fixturesData?.response ?? []
  const finishedFixtures = allFixtures.filter(
  f =>
    f.league?.id === body.leagueId &&
    f.league?.season === body.season &&
    FINISHED.has(f.fixture?.status?.short)
)

  if (finishedFixtures.length === 0) {
    return NextResponse.json({
      ok:       true,
      date:     body.date,
      leagueId: body.leagueId,
      found:    allFixtures.length,
      synced:   0,
      matches:  [],
      note:     'No hay partidos terminados para esta fecha/liga.',
    })
  }

  // ── Procesar cada fixture terminado ───────────────────────────────────
  const results: SyncedMatch[] = []

  for (const f of finishedFixtures) {
    const fixtureId  = f.fixture.id as number
    const homeName   = f.teams.home.name as string
    const awayName   = f.teams.away.name as string
    const matchId    = buildMatchId(homeName, awayName, body.date)

    try {
      // ── 1. Fetch events y lineups ─────────────────────────────────────
      const [eventsData, lineupsData] = await Promise.all([
        afFetch(`/fixtures/events?fixture=${fixtureId}`, apiKey),
        afFetch(`/fixtures/lineups?fixture=${fixtureId}`, apiKey),
      ])

      // ── 2. Construir raw row ──────────────────────────────────────────
      // raw_fixture guarda el response completo del endpoint /fixtures
      // (el item del array, envuelto en { response: [...] } para consistencia)
      const rawRow = {
        provider:            'api-football',
        external_fixture_id: fixtureId,
        internal_match_id:   matchId,
        raw_fixture:         { response: [f] },              // response[0] = el fixture completo
        raw_events:          eventsData,                     // { response: [...] }
        raw_lineups:         lineupsData,                    // { response: [...] }
        sync_status:         'synced',
        synced_at:           new Date().toISOString(),
      }

      // ── 3. Upsert raw en api_football_raw_fixtures ───────────────────
      const { error: rawError } = await supabaseServer
        .from('api_football_raw_fixtures')
        .upsert(rawRow, { onConflict: 'provider,external_fixture_id' })

      if (rawError) {
        throw new Error(`Error al guardar raw: ${rawError.message}`)
      }

      // ── 4. Transformar ────────────────────────────────────────────────
      const lineupCount = (lineupsData as any)?.response?.length ?? 0
      if (lineupCount < 2) {
        // Partido terminado sin lineups — raro pero posible (walkover, abandono, etc.)
        results.push({
          fixtureId,
          matchId,
          home:   homeName,
          away:   awayName,
          status: 'skipped',
          error:  `Solo ${lineupCount} lineup(s) disponibles — se guardó el raw pero no se persistió el match`,
        })
        continue
      }

      const match = buildMatchFromRaw(rawRow as unknown as RawFixtureRow)

      // ── 5. Upsert match en matches_api ────────────────────────────────
      const { error: matchError } = await supabaseServer
        .from('matches_api')
        .upsert(
  {
    id: match.id,
    external_fixture_id: fixtureId,
    data: match,
    source: 'api-football',
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'id' }
)

      if (matchError) {
        throw new Error(`Error al guardar match: ${matchError.message}`)
      }

      results.push({ fixtureId, matchId, home: homeName, away: awayName, status: 'synced' })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[sync-finished-fixtures] fixture ${fixtureId} error:`, msg)
      results.push({ fixtureId, matchId, home: homeName, away: awayName, status: 'error', error: msg })
    }
  }

  const syncedCount = results.filter(r => r.status === 'synced').length

  return NextResponse.json({
    ok:       true,
    date:     body.date,
    leagueId: body.leagueId,
    found:    finishedFixtures.length,
    synced:   syncedCount,
    matches:  results,
  })
}
