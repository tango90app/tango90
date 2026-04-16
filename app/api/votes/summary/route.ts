import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  } catch (e) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // ── DEBUG: fetch by match_id + target_type only, filter target_id in JS ──
  const { data: partial, error: partialError } = await db
    .from('votes')
    .select('score, target_id, anon_id')
    .eq('match_id',    match_id)
    .eq('target_type', target_type)

  if (partialError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Log every row's target_id vs the incoming target_id — char by char
  for (const row of partial ?? []) {
    const match = row.target_id === target_id
    console.log(
      `  row target_id repr: ${JSON.stringify(row.target_id)}`,
      `| bytes: ${Buffer.from(row.target_id).toString('hex')}`,
      `| match: ${match}`,
      `| score: ${row.score}`
    )
  }

  // Filter in JS so we can see what actually matches
  const matched = (partial ?? []).filter(r => r.target_id === target_id)

  const count = matched.length
  const avg   = count > 0
    ? matched.reduce((sum, r) => sum + (r.score as number), 0) / count
    : null

  // myVote
  let myVote: number | null = null
  if (anon_id) {
    const own = matched.find(r => r.anon_id === anon_id)
    myVote = own?.score ?? null
  }

return NextResponse.json(
  {
    avg,
    count,
    myVote
  },
  {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
)
}
