import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const secret = process.env.SYNC_SECRET

  if (!secret || searchParams.get('secret') !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const apiKey = process.env.API_FOOTBALL_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API_FOOTBALL_KEY' },
      { status: 500 }
    )
  }

  const res = await fetch(
    'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
    {
      headers: {
        'x-apisports-key': apiKey,
      },
      cache: 'no-store',
    }
  )

  const data = await res.json()

  return NextResponse.json(data)
}