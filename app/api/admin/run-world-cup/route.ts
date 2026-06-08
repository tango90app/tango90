import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(
    'http://localhost:3000/api/admin/track-world-cup',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.SYNC_SECRET,
      }),
    }
  )

  const data = await res.json()

  return NextResponse.json(data)
}