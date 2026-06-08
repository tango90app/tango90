import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const secret = process.env.SYNC_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'SYNC_SECRET no configurado' },
      { status: 500 }
    )
  }

  if (searchParams.get('secret') !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API_FOOTBALL_KEY no configurado' },
      { status: 500 }
    )
  }

  const name = searchParams.get('name')?.trim()

  if (!name || name.length < 3) {
    return NextResponse.json(
      { error: 'name requerido (mínimo 3 caracteres)' },
      { status: 400 }
    )
  }

  const res = await fetch(
    `https://v3.football.api-sports.io/leagues?search=${encodeURIComponent(name)}`,
    {
      headers: {
        'x-apisports-key': apiKey,
      },
      cache: 'no-store',
    }
  )

  const raw = await res.json()

  const leagues = (raw?.response ?? []).flatMap((item: any) =>
    (item.seasons ?? []).map((season: any) => ({
      leagueId: item.league?.id,
      leagueName: item.league?.name,
      country: item.country?.name,
      season: season.year,
      current: season.current,
    }))
  )

  return NextResponse.json(leagues)
}