import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase env vars')
  }

  return createClient(url, key, { auth: { persistSession: false } })
}

function getApiFootballConfig() {
  const apiKey = process.env.API_FOOTBALL_KEY
  const baseUrl = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io'

  if (!apiKey) {
    throw new Error('Missing API_FOOTBALL_KEY')
  }

  return { apiKey, baseUrl }
}

function isFinishedStatus(shortStatus: string | undefined) {
  return shortStatus === 'FT' || shortStatus === 'AET' || shortStatus === 'PEN'
}

export async function POST(req: NextRequest) {
  let body: {
    secret?: string
    fixtureId?: number
    internalMatchId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const expectedSecret = process.env.SYNC_SECRET

  if (!expectedSecret || body.secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!body.fixtureId || !body.internalMatchId) {
    return NextResponse.json(
      { error: 'fixtureId and internalMatchId are required' },
      { status: 400 }
    )
  }

  let db
  let apiConfig

  try {
    db = getServerClient()
    apiConfig = getApiFootballConfig()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server configuration error' },
      { status: 500 }
    )
  }

  const fixtureId = body.fixtureId
  const internalMatchId = body.internalMatchId

  const headers = {
    'x-apisports-key': apiConfig.apiKey,
  }

  const fixtureRes = await fetch(
    `${apiConfig.baseUrl}/fixtures?id=${fixtureId}`,
    { headers, cache: 'no-store' }
  )

  const fixture = await fixtureRes.json()
  const fixtureRow = fixture?.response?.[0]
  const shortStatus = fixtureRow?.fixture?.status?.short

  if (!fixtureRow) {
    return NextResponse.json(
      {
        ok: false,
        synced: false,
        reason: 'fixture_not_found',
        fixtureId,
      },
      { status: 404 }
    )
  }

  if (!isFinishedStatus(shortStatus)) {
    return NextResponse.json({
      ok: true,
      synced: false,
      reason: 'fixture_not_finished',
      fixtureId,
      status: shortStatus,
    })
  }

  const [eventsRes, lineupsRes] = await Promise.all([
    fetch(`${apiConfig.baseUrl}/fixtures/events?fixture=${fixtureId}`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiConfig.baseUrl}/fixtures/lineups?fixture=${fixtureId}`, {
      headers,
      cache: 'no-store',
    }),
  ])

  const events = await eventsRes.json()
  const lineups = await lineupsRes.json()

  const now = new Date().toISOString()

  const { error } = await db
    .from('api_football_raw_fixtures')
    .upsert(
      {
        provider: 'api-football',
        external_fixture_id: fixtureId,
        internal_match_id: internalMatchId,
        raw_fixture: fixture,
        raw_events: events,
        raw_lineups: lineups,
        sync_status: 'synced',
        synced_at: now,
        updated_at: now,
      },
      {
        onConflict: 'provider,external_fixture_id',
      }
    )

  if (error) {
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
        code: error.code,
        hint: error.hint,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    synced: true,
    fixtureId,
    internalMatchId,
    status: shortStatus,
  })
}