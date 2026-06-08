import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const AF_BASE = 'https://v3.football.api-sports.io'

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
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString()
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const secret = process.env.SYNC_SECRET
  const apiKey = process.env.API_FOOTBALL_KEY

  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API_FOOTBALL_KEY' }, { status: 500 })
  }

const leagueId = 1
const season = 2026

const res = await fetch(
  `${AF_BASE}/fixtures?league=1&season=2026`,
  {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
  }
)

const data = await res.json()

const selected = data?.response ?? []


  const rows = selected.map((f: any) => {
    const fixtureId = f.fixture.id
    const kickoffAt = f.fixture.date
    const fixtureDate = kickoffAt.slice(0, 10)

    const home = f.teams.home.name
    const away = f.teams.away.name
    const internalMatchId = buildMatchId(home, away, fixtureDate)

    return {
      provider: 'api-football',
      external_fixture_id: fixtureId,
      internal_match_id: internalMatchId,
      league_id: f.league.id,
league_name: f.league.name,
league_logo: f.league.logo ?? null,
season,
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
      updated_at: new Date().toISOString(),
    }
  })

  if (rows.length > 0) {
    const { error } = await supabaseServer
      .from('tracked_fixtures')
      .upsert(rows, { onConflict: 'provider,external_fixture_id' })

    if (error) {
      return NextResponse.json(
        { error: 'Database error', detail: error.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    leagueId,
    season,
    found: selected.length,
    tracked: rows.map((r: any) => ({
      fixtureId: r.external_fixture_id,
      matchId: r.internal_match_id,
      home: r.home_name,
      away: r.away_name,
      status: r.status,
      kickoffAt: r.kickoff_at,
      startCheckAt: r.start_check_at,
    })),
  })
}