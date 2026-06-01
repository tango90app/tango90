import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// ── GET /api/admin/list-league-teams ─────────────────────────────────────
//
// Endpoint de diagnóstico: devuelve los equipos de una liga/temporada
// directamente desde API-Football, sin transformar ni guardar nada.
//
// Uso: cruzar manualmente tu lista de equipos con sus apiFootballId reales.
// Eliminar este archivo una vez completado el mapeo.
//
// Query params:
//   secret   — SYNC_SECRET (requerido)
//   league   — ID de liga en API-Football (default: 128 = Liga Profesional AR)
//   season   — temporada (default: 2026)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const secret = process.env.SYNC_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SYNC_SECRET no configurado' }, { status: 500 })
  }
  if (searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API_FOOTBALL_KEY no configurado' }, { status: 500 })
  }

  const league = searchParams.get('league') ?? '128'
  const season = searchParams.get('season') ?? '2026'

  const url = `https://v3.football.api-sports.io/teams?league=${league}&season=${season}`

  let raw: any
  try {
    const res = await fetch(url, {
      headers: {
        'x-apisports-key': apiKey,
        'Accept':          'application/json',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `API-Football respondió ${res.status}`, url },
        { status: 502 }
      )
    }
    raw = await res.json()
    console.log(JSON.stringify(raw, null, 2))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Error al consultar API-Football', detail: msg }, { status: 502 })
  }

  const teams = (raw?.response ?? []).map((item: any) => ({
    apiFootballId: item.team?.id          ?? null,
    apiName:       item.team?.name        ?? null,
    country:       item.team?.country     ?? null,
    logo:          item.team?.logo        ?? null,
    founded:       item.team?.founded     ?? null,
    national:      item.team?.national    ?? null,
  }))

  // Ordenar alfabéticamente para facilitar el cruce manual
  teams.sort((a: any, b: any) => (a.apiName ?? '').localeCompare(b.apiName ?? '', 'es'))

  return NextResponse.json(teams)
}