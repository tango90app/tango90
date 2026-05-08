import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function getArgentinaDate() {
  return new Date().toLocaleDateString('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

export async function GET(req: NextRequest) {
  const secretFromUrl = req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.SYNC_SECRET

  if (!expectedSecret || secretFromUrl !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = getArgentinaDate()

  const res = await fetch(`${req.nextUrl.origin}/api/admin/track-fixtures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: expectedSecret,
      date,
      leagueId: 128,
      season: 2026,
    }),
    cache: 'no-store',
  })

  const data = await res.json()

  return NextResponse.json({
    ok: res.ok,
    job: 'track-lpf-fixtures',
    date,
    result: data,
  }, { status: res.status })
}