import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { data, error } = await supabaseServer
    .from('matches_api')
    .select('id, data, source, external_fixture_id, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Database error', detail: error.message },
      { status: 500 }
    )
  }

  const matches = (data ?? []).map(row => row.data)

  return NextResponse.json({
    ok: true,
    count: matches.length,
    matches,
  })
}