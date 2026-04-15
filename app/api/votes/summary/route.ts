import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const match_id    = searchParams.get('match_id')
  const target_type = searchParams.get('target_type')
  const target_id   = searchParams.get('target_id')
  const anon_id     = searchParams.get('anon_id') ?? ''

  if (!match_id || !target_type || !target_id) {
    return NextResponse.json({ error: 'match_id, target_type, target_id are required' }, { status: 400 })
  }

  // Fetch all votes for this entity
  const { data, error } = await supabaseServer
    .from('votes')
    .select('score, anon_id')
    .eq('match_id',    match_id)
    .eq('target_type', target_type)
    .eq('target_id',   target_id)

  if (error) {
    console.error('[votes/summary GET] error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const votes = data ?? []
  const count = votes.length
  const avg   = count > 0 ? votes.reduce((s, v) => s + v.score, 0) / count : null

  // Find the current user's vote if anon_id provided
  const myVote = anon_id
    ? (votes.find(v => v.anon_id === anon_id)?.score ?? null)
    : null

  return NextResponse.json({ avg, count, myVote }, { status: 200 })
}
