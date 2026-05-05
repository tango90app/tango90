import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { matches } from '@/data/matches'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { data: apiRows, error: apiError } = await supabaseServer
    .from('matches_api')
    .select('id, data, updated_at')
    .order('updated_at', { ascending: false })

  const { data: trackedRows, error: trackedError } = await supabaseServer
    .from('tracked_fixtures')
    .select('*')
    .order('kickoff_at', { ascending: true })

  return NextResponse.json({
    ok: true,
    apiError: apiError?.message ?? null,
    trackedError: trackedError?.message ?? null,
    matchesApi: (apiRows ?? []).map((r: any) => ({
      rowId: r.id,
      matchId: r.data?.id,
      home: r.data?.home?.name,
      away: r.data?.away?.name,
      status: r.data?.status,
      updatedAt: r.updated_at,
    })),
    trackedFixtures: (trackedRows ?? []).map((r: any) => ({
      fixtureId: r.external_fixture_id,
      matchId: r.internal_match_id,
      home: r.home_name,
      away: r.away_name,
      status: r.status,
      published: r.published,
      synced: r.synced,
    })),
    hardcodedMatches: matches.map(m => ({
      id: m.id,
      home: m.home.name,
      away: m.away.name,
      status: m.status,
    })),
  })
}