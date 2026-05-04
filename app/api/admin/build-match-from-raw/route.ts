import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { buildMatchFromRaw, type RawFixtureRow } from '@/lib/buildMatchFromRaw'

export const runtime = 'nodejs'

// ── POST /api/admin/build-match-from-raw ─────────────────────────────────
//
// Lee el raw guardado en `api_football_raw_fixtures` y devuelve el objeto
// Match transformado para inspección. No persiste nada.
//
// Body:
//   { "secret": "...", "externalFixtureId": 157201 }

type Body = {
  secret:            string
  externalFixtureId: number
}

export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SYNC_SECRET no configurado en el servidor' }, { status: 500 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (!body.secret || body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!body.externalFixtureId || typeof body.externalFixtureId !== 'number') {
    return NextResponse.json({ error: 'externalFixtureId requerido (number)' }, { status: 400 })
  }

  // ── Leer raw de Supabase ──────────────────────────────────────────────
  const { data, error } = await supabaseServer
    .from('api_football_raw_fixtures')
    .select('*')
    .eq('external_fixture_id', body.externalFixtureId)
    .maybeSingle()

  if (error) {
    console.error('[build-match-from-raw] DB error:', error)
    return NextResponse.json({ error: 'Error al leer de Supabase', detail: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(
      {
        error: `No hay raw guardado para fixtureId ${body.externalFixtureId}.`,
        hint:  'Primero llamá a POST /api/admin/sync-fixture para sincronizar.',
      },
      { status: 404 }
    )
  }

  const row = data as RawFixtureRow

  // ── Validación previa: lineups disponibles ────────────────────────────
  const lineupCount = row.raw_lineups?.response?.length ?? 0
  if (lineupCount < 2) {
    return NextResponse.json(
      {
        error:           'El raw no tiene lineups completos.',
        lineupCount,
        sync_status:     row.sync_status,
        synced_at:       row.synced_at,
        fixture_status:  row.raw_fixture?.response?.[0]?.fixture?.status?.short ?? 'desconocido',
        hint:            'API-Football solo devuelve lineups una vez que el partido empezó. Re-sincronizá después del inicio.',
      },
      { status: 422 }
    )
  }

  // ── Transformar ───────────────────────────────────────────────────────
  let match
  try {
    match = buildMatchFromRaw(row)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[build-match-from-raw] transform error:', message)
    return NextResponse.json({ error: 'Error al transformar el raw', detail: message }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    match,
    meta: {
      internalMatchId:   row.internal_match_id,
      externalFixtureId: row.external_fixture_id,
      syncStatus:        row.sync_status,
      syncedAt:          row.synced_at,
      eventCount:        row.raw_events?.response?.length ?? 0,
      homePlayerCount:   match.home.players.length,
      awayPlayerCount:   match.away.players.length,
    },
  })
}
