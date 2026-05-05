import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// ── GET /api/admin/search-team ────────────────────────────────────────────
//
// Endpoint de diagnóstico: busca equipos por nombre en API-Football.
// Solo para obtener/verificar apiFootballId. No guarda ni transforma nada.
//
// Query params:
//   secret  — SYNC_SECRET (requerido)
//   name    — nombre o parte del nombre a buscar (requerido, mínimo 3 chars)
//
// Ejemplos:
//   /api/admin/search-team?secret=...&name=Aldosivi
//   /api/admin/search-team?secret=...&name=Gimnasia%20Mendoza
//   /api/admin/search-team?secret=...&name=Estudiantes%20Rio%20Cuarto

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

  const name = searchParams.get('name')?.trim()
  if (!name || name.length < 3) {
    return NextResponse.json(
      { error: 'name requerido, mínimo 3 caracteres' },
      { status: 400 }
    )
  }

  const url = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Error al consultar API-Football', detail: msg }, { status: 502 })
  }

  const teams = (raw?.response ?? []).map((item: any) => ({
    apiFootballId: item.team?.id       ?? null,
    apiName:       item.team?.name     ?? null,
    country:       item.team?.country  ?? null,
    logo:          item.team?.logo     ?? null,
    founded:       item.team?.founded  ?? null,
    national:      item.team?.national ?? null,
  }))

  return NextResponse.json({
    query:   name,
    results: teams.length,
    teams,
  })
}