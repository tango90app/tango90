import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { buildMatchFromRaw, type RawFixtureRow } from '@/lib/buildMatchFromRaw'

export const runtime = 'nodejs'

type Body = {
  secret: string
  externalFixtureId: number
}

export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'SYNC_SECRET missing' }, { status: 500 })
  }

  const body: Body = await req.json()

  if (body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. traer raw
  const { data, error } = await supabaseServer
    .from('api_football_raw_fixtures')
    .select('*')
    .eq('external_fixture_id', body.externalFixtureId)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Raw no encontrado' }, { status: 404 })
  }

  const row = data as RawFixtureRow

  // 2. transformar
  let match
  try {
    match = buildMatchFromRaw(row)
  } catch (e) {
    return NextResponse.json({ error: 'Error transformando match' }, { status: 422 })
  }

  // 3. guardar en matches_api
  const { error: upsertError } = await supabaseServer
    .from('matches_api')
    .upsert({
      id: match.id,
      external_fixture_id: body.externalFixtureId,
      data: match,
      source: 'api-football'
    })

  if (upsertError) {
    console.error(upsertError)
    return NextResponse.json({ error: 'Error guardando match' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    stored: true,
    matchId: match.id
  })
}