import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const secretFromUrl = req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.SYNC_SECRET

  if (!expectedSecret || secretFromUrl !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`${req.nextUrl.origin}/api/admin/check-tracked-fixtures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: expectedSecret }),
    cache: 'no-store',
  })

  const data = await res.json()

  return NextResponse.json(data, { status: res.status })
}