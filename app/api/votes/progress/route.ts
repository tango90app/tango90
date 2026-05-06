import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { getMatchPhase } from '@/lib/matchPhase'
import { getVotableSections, computeProgress } from '@/lib/voteProgress'
import { matches, type Match } from '@/data/matches'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const match_id = searchParams.get('match_id') ?? ''
  const anon_id = searchParams.get('anon_id') ?? ''

  if (!match_id || !anon_id) {
    return NextResponse.json(
      { error: 'match_id and anon_id are required' },
      { status: 400 }
    )
  }

  const { data: apiRow } = await supabaseServer
    .from('matches_api')
    .select('data')
    .eq('id', match_id)
    .maybeSingle()

  const match: Match | undefined =
    (apiRow?.data as Match | undefined) ??
    matches.find(m => m.id === match_id)

  const phase = match ? getMatchPhase(match.match_end_at).phase : 'not_available'

  const sections = match ? getVotableSections(match) : null

  if (!sections) {
    return NextResponse.json(
      {
        voted: 0,
        total: 0,
        homeComplete: false,
        awayComplete: false,
        allComplete: false,
        homeTeamId: '',
        awayTeamId: '',
        homeTeamName: '',
        awayTeamName: '',
        plaques: [],
        phase,
      },
      { headers: NO_CACHE }
    )
  }

  const { data: votes, error: votesError } = await supabaseServer
    .from('votes')
    .select('target_id')
    .eq('match_id', match_id)
    .eq('anon_id', anon_id)

  if (votesError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const votedIds = (votes ?? []).map(v => v.target_id as string)
  const progress = computeProgress(sections, votedIds)

  const { data: plaquesData } = await supabaseServer
    .from('plaques')
    .select('type, team_id, created_at')
    .eq('anon_id', anon_id)
    .eq('match_id', match_id)
    .order('created_at', { ascending: true })

  const plaques = (plaquesData ?? []).map(p => ({
    type: p.type as 'team' | 'match',
    teamId: (p.team_id ?? undefined) as string | undefined,
  }))

  return NextResponse.json(
    { ...progress, plaques, phase },
    { headers: NO_CACHE }
  )
}