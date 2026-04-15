import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

type Body = {
  match_id:    string
  target_type: 'player' | 'coach' | 'referee'
  target_id:   string
  score:       number
  anon_id:     string
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { match_id, target_type, target_id, score, anon_id } = body

  // ── Validation ────────────────────────────────────────────────────────────
  if (!match_id || typeof match_id !== 'string') {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }
  if (!['player', 'coach', 'referee'].includes(target_type)) {
    return NextResponse.json({ error: 'target_type must be player, coach, or referee' }, { status: 400 })
  }
  if (!target_id || typeof target_id !== 'string') {
    return NextResponse.json({ error: 'target_id is required' }, { status: 400 })
  }
  if (typeof score !== 'number' || score < 1 || score > 10 || !Number.isInteger(score)) {
    return NextResponse.json({ error: 'score must be an integer between 1 and 10' }, { status: 400 })
  }
  if (!anon_id || typeof anon_id !== 'string' || anon_id.length < 8) {
    return NextResponse.json({ error: 'anon_id is required' }, { status: 400 })
  }

  // ── Duplicate check ───────────────────────────────────────────────────────
  const { data: existing, error: checkError } = await supabaseServer
    .from('votes')
    .select('id')
    .eq('match_id',    match_id)
    .eq('target_type', target_type)
    .eq('target_id',   target_id)
    .eq('anon_id',     anon_id)
    .maybeSingle()

  if (checkError) {
    console.error('[votes POST] duplicate check error:', checkError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ error: 'Already voted', code: 'DUPLICATE' }, { status: 409 })
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { error: insertError } = await supabaseServer
    .from('votes')
    .insert({ match_id, target_type, target_id, score, anon_id })

  if (insertError) {
    console.error('[votes POST] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
