import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  const body = await req.json()

  const secret = process.env.SYNC_SECRET
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = body.date
  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  const baseUrl = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io'

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API_FOOTBALL_KEY' }, { status: 500 })
  }

  const res = await fetch(`${baseUrl}/fixtures?date=${date}`, {
    headers: {
      'x-apisports-key': apiKey,
    },
    cache: 'no-store',
  })

  const data = await res.json()

  return NextResponse.json(data)
}