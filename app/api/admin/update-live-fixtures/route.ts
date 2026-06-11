import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const AF_BASE = 'https://v3.football.api-sports.io'

export async function POST(req: Request) {
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

  const now = new Date()

  const fourHoursAgo = new Date(
    now.getTime() - 4 * 60 * 60 * 1000
  ).toISOString()

  const { data: fixtures, error } = await supabaseServer
    .from('tracked_fixtures')
    .select('*')
    .eq('synced', false)
    .lte('kickoff_at', now.toISOString())
    .gte('kickoff_at', fourHoursAgo)

    console.log(
  'LIVE FIXTURES FOUND',
  fixtures?.map(f => ({
    id: f.internal_match_id,
    kickoff_at: f.kickoff_at,
    synced: f.synced,
    status: f.status,
  }))
)

  if (error) {
    return NextResponse.json(
      {
        error: 'Database error',
        detail: error.message,
      },
      { status: 500 }
    )
  }

  const results = []

  for (const fixture of fixtures ?? []) {
    try {
      const res = await fetch(
        `${AF_BASE}/fixtures?id=${fixture.external_fixture_id}`,
        {
          headers: {
            'x-apisports-key': apiKey,
          },
          cache: 'no-store',
        }
      )

      const data = await res.json()

      const apiFixture = data?.response?.[0]

      if (!apiFixture) {
        continue
      }

      const apiStatus =
        apiFixture.fixture?.status?.short ?? null

      const minute =
        apiFixture.fixture?.status?.elapsed ?? null

      const homeScore =
        apiFixture.goals?.home ?? 0

      const awayScore =
        apiFixture.goals?.away ?? 0

      await supabaseServer
        .from('tracked_fixtures')
        .update({
          status: apiStatus ?? fixture.status,
          api_status: apiStatus,
          minute,
          home_score: homeScore,
          away_score: awayScore,
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq(
          'external_fixture_id',
          fixture.external_fixture_id
        )

      results.push({
        fixtureId: fixture.external_fixture_id,
        status: apiStatus,
        minute,
        score: `${homeScore}-${awayScore}`,
      })
    } catch (err) {
      results.push({
        fixtureId: fixture.external_fixture_id,
        error:
          err instanceof Error
            ? err.message
            : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: fixtures?.length ?? 0,
    results,
  })
}