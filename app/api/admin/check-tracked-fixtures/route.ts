import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const AF_BASE = 'https://v3.football.api-sports.io'
const FINISHED = new Set(['FT', 'AET', 'PEN'])
const SUSPENDED = new Set(['ABD', 'PST', 'CANC', 'SUSP'])

export async function POST(req: NextRequest) {
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const secret = process.env.SYNC_SECRET
  const apiKey = process.env.API_FOOTBALL_KEY

  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 })
  }

  const now = new Date().toISOString()

  const { data: fixtures, error: fixturesError } = await supabaseServer
    .from('tracked_fixtures')
    .select('*')
    .eq('synced', false)
    .lte('start_check_at', now)

  if (fixturesError) {
    return NextResponse.json(
      { error: 'Database error', detail: fixturesError.message },
      { status: 500 }
    )
  }

  const results = []

  for (const f of fixtures ?? []) {
    try {
      const res = await fetch(`${AF_BASE}/fixtures?id=${f.external_fixture_id}`, {
        headers: { 'x-apisports-key': apiKey },
        cache: 'no-store',
      })

      const data = await res.json()
      const fixture = data?.response?.[0]
      const status = fixture?.fixture?.status?.short

            if (SUSPENDED.has(status)) {
        await supabaseServer
          .from('tracked_fixtures')
          .update({
            status: 'suspended',
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('external_fixture_id', f.external_fixture_id)

        results.push({
          fixtureId: f.external_fixture_id,
          matchId: f.internal_match_id,
          status: 'suspended',
          apiStatus: status,
        })

        continue
      }

      if (!FINISHED.has(status)) {
        await supabaseServer
          .from('tracked_fixtures')
          .update({
            status: status ?? f.status,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('external_fixture_id', f.external_fixture_id)

        results.push({
          fixtureId: f.external_fixture_id,
          matchId: f.internal_match_id,
          status: 'not_finished',
          apiStatus: status,
        })

        continue
      }

      const syncRes = await fetch(`${req.nextUrl.origin}/api/admin/sync-fixture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          fixtureId: f.external_fixture_id,
          internalMatchId: f.internal_match_id,
        }),
      })

      const syncData = await syncRes.json()

      if (!syncRes.ok || !syncData.ok) {
        throw new Error(`sync-fixture failed: ${JSON.stringify(syncData)}`)
      }

      const persistRes = await fetch(`${req.nextUrl.origin}/api/admin/persist-match-from-raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          externalFixtureId: f.external_fixture_id,
        }),
      })

      const persistData = await persistRes.json()

      if (!persistRes.ok || !persistData.ok) {
        throw new Error(`persist-match-from-raw failed: ${JSON.stringify(persistData)}`)
      }

      await supabaseServer
        .from('tracked_fixtures')
        .update({
          synced: true,
          published: true,
          status: 'finished',
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('external_fixture_id', f.external_fixture_id)

      results.push({
        fixtureId: f.external_fixture_id,
        matchId: f.internal_match_id,
        status: 'published',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      results.push({
        fixtureId: f.external_fixture_id,
        matchId: f.internal_match_id,
        status: 'error',
        error: message,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: fixtures?.length ?? 0,
    results,
  })
}