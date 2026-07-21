import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const AF_BASE = 'https://v3.football.api-sports.io'

const competitions = [
  {
    leagueId: 128,
    season: 2026,
    name: 'LPF Clausura',
  },
  {
    leagueId: 13,
    season: 2026,
    name: 'Copa Libertadores',
  },
  {
    leagueId: 11,
    season: 2026,
    name: 'Copa Sudamericana',
  },
]

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function buildMatchId(home: string, away: string, date: string) {
  return `${slugify(home)}-${slugify(away)}-${date}`
}

function addMinutes(iso: string, minutes: number) {
  return new Date(
    new Date(iso).getTime() + minutes * 60 * 1000
  ).toISOString()
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const secret = process.env.SYNC_SECRET
  const apiKey = process.env.API_FOOTBALL_KEY

  if (!secret || body.secret !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API_FOOTBALL_KEY' },
      { status: 500 }
    )
  }

  const fromDate = new Date()

  const toDate = new Date(fromDate)
  toDate.setUTCDate(toDate.getUTCDate() + 21)

  const from = formatDate(fromDate)
  const to = formatDate(toDate)

  const selected: any[] = []
  const competitionResults: any[] = []

  for (const competition of competitions) {
    const url =
      `${AF_BASE}/fixtures` +
      `?league=${competition.leagueId}` +
      `&season=${competition.season}` +
      `&from=${from}` +
      `&to=${to}`

    const res = await fetch(url, {
      headers: {
        'x-apisports-key': apiKey,
      },
      cache: 'no-store',
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `API-Football error for ${competition.name}`,
          detail: data,
        },
        { status: 502 }
      )
    }

    const fixtures = data?.response ?? []

    selected.push(...fixtures)

    competitionResults.push({
      name: competition.name,
      leagueId: competition.leagueId,
      season: competition.season,
      found: fixtures.length,
      apiErrors: data?.errors ?? null,
    })
  }

  const updatedAt = new Date().toISOString()

  const rows = selected.map((f: any) => {
    const fixtureId = f.fixture.id
    const kickoffAt = f.fixture.date
    const fixtureDate = kickoffAt.slice(0, 10)

    const home = f.teams.home.name
    const away = f.teams.away.name

    const internalMatchId = buildMatchId(
      home,
      away,
      fixtureDate
    )

    return {
      provider: 'api-football',
      external_fixture_id: fixtureId,
      internal_match_id: internalMatchId,

      league_id: f.league.id,
      league_name: f.league.name,
      league_logo: f.league.logo ?? null,
      season: f.league.season ?? 2026,

      fixture_date: fixtureDate,
      kickoff_at: kickoffAt,

      home_team_id: f.teams.home.id,
      away_team_id: f.teams.away.id,
      home_name: home,
      away_name: away,

      round: f.league.round ?? null,
      status: f.fixture.status?.short ?? 'NS',

      published: false,
      synced: false,

      start_check_at: addMinutes(kickoffAt, 110),
      stop_check_at: addMinutes(kickoffAt, 150),

      updated_at: updatedAt,
    }
  })

  if (rows.length > 0) {
    const { error } = await supabaseServer
      .from('tracked_fixtures')
      .upsert(rows, {
        onConflict: 'provider,external_fixture_id',
      })

    if (error) {
      return NextResponse.json(
        {
          error: 'Database error',
          detail: error.message,
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    dateRange: {
      from,
      to,
    },
    competitions: competitionResults,
    found: selected.length,
    tracked: rows.map((row: any) => ({
      fixtureId: row.external_fixture_id,
      matchId: row.internal_match_id,
      league: row.league_name,
      round: row.round,
      home: row.home_name,
      away: row.away_name,
      status: row.status,
      kickoffAt: row.kickoff_at,
      startCheckAt: row.start_check_at,
    })),
  })
}