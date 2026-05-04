import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMatchPhase } from '@/lib/matchPhase'
import { matches } from '@/data/matches'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const match_id    = searchParams.get('match_id')    ?? ''
  const target_type = searchParams.get('target_type') ?? ''
  const target_id   = searchParams.get('target_id')   ?? ''
  const anon_id     = searchParams.get('anon_id')     ?? ''

  if (!match_id || !target_type || !target_id) {
    return NextResponse.json(
      { error: 'match_id, target_type, target_id are required' },
      { status: 400 }
    )
  }

  let db
  try {
    db = getServerClient()
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Fase del partido
  const match = matches.find(m => m.id === match_id)
  const phase = match ? getMatchPhase(match.match_end_at).phase : 'not_available'

  // Votos para esta entidad
  const { data: rows, error } = await db
    .from('votes')
    .select('score, target_id, anon_id')
    .eq('match_id',    match_id)
    .eq('target_type', target_type)
    .eq('target_id',   target_id)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const count = rows?.length ?? 0
  const avg   = count > 0
    ? (rows!.reduce((sum, r) => sum + (r.score as number), 0)) / count
    : null

  let myVote: number | null = null
  if (anon_id && rows) {
    const own = rows.find(r => r.anon_id === anon_id)
    myVote = own?.score ?? null
  }

  return NextResponse.json(
    { avg, count, myVote, phase },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma':        'no-cache',
        'Expires':       '0',
      },
    }
  )
}
