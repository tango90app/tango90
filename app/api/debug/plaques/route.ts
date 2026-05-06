// ── ENDPOINT DE DIAGNÓSTICO — remover antes de producción ─────────────────
// GET /api/debug/plaques?match_id=x&anon_id=y

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { getVotableSections, computeProgress } from '@/lib/voteProgress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const match_id = req.nextUrl.searchParams.get('match_id') ?? ''
  const anon_id  = req.nextUrl.searchParams.get('anon_id')  ?? ''
  if (!match_id || !anon_id) return NextResponse.json({ error: 'match_id y anon_id requeridos' }, { status: 400 })

  const { error: tableError } = await supabaseServer.from('plaques').select('id').limit(1)
  const tableExists = !tableError

  // const sections = getVotableSections(match_id)

  const { data: votes } = await supabaseServer
    .from('votes').select('target_id, target_type')
    .eq('match_id', match_id).eq('anon_id', anon_id)
  const votedIds = (votes ?? []).map(v => v.target_id as string)

  const progress = sections ? computeProgress(sections, votedIds) : null

  const { data: plaques, error: plaquesError } = tableExists
    ? await supabaseServer.from('plaques').select('type, team_id, created_at').eq('anon_id', anon_id).eq('match_id', match_id)
    : { data: null, error: null }

  return NextResponse.json({
    tableExists,
    tableError: tableError?.message ?? null,
    sections: sections ? {
      homeTargetIds: sections.homeTargetIds,
      awayTargetIds: sections.awayTargetIds,
      refereeTargetId: sections.refereeTargetId,
      total: sections.total,
    } : null,
    votedIds,
    votedCount: votedIds.length,
    progress,
    missingHome: sections ? sections.homeTargetIds.filter(id => !votedIds.includes(id)) : [],
    missingAway: sections ? sections.awayTargetIds.filter(id => !votedIds.includes(id)) : [],
    plaques: plaques ?? [],
    plaquesError: plaquesError?.message ?? null,
  })
}
