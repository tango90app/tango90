import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

const AF_BASE = 'https://v3.football.api-sports.io'
const FINISHED = new Set(['FT', 'AET', 'PEN'])

export async function POST(req: NextRequest) {
  const body = await req.json()

  const secret = process.env.SYNC_SECRET
  const apiKey = process.env.API_FOOTBALL_KEY

  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 })
  }

  const now = new Date().toISOString()

  // buscar partidos que ya están en ventana de chequeo
  const { data: fixtures } = await supabaseServer
    .from('tracked_fixtures')
    .select('*')
    .eq('synced', false)
    .lte('start_check_at', now)

  const results = []

  for (const f of fixtures ?? []) {
    try {
      const res = await fetch(
        `${AF_BASE}/fixtures?id=${f.external_fixture_id}`,
        {
          headers: { 'x-apisports-key': apiKey },
          cache: 'no-store',
        }
      )

      const data = await res.json()
      const fixture = data?.response?.[0]

      const status = fixture?.fixture?.status?.short

      if (!FINISHED.has(status)) {
        results.push({
          fixtureId: f.external_fixture_id,
          status: 'not_finished',
        })
        continue
      }

      // ya terminó → usamos tu endpoint existente
      const syncRes = await fetch(
  `http://localhost:3000/api/admin/sync-fixture`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret,
            fixtureId: f.external_fixture_id,
          }),
        }
      )

      const syncData = await syncRes.json()

      await supabaseServer
        .from('tracked_fixtures')
        .update({
          synced: true,
          published: true,
          status: 'finished',
          updated_at: new Date().toISOString(),
        })
        .eq('external_fixture_id', f.external_fixture_id)

      results.push({
        fixtureId: f.external_fixture_id,
        status: 'synced',
      })
    } catch (err) {
  const message = err instanceof Error ? err.message : String(err)

  results.push({
    fixtureId: f.external_fixture_id,
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