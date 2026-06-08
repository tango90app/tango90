import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    error:
      'run-world-cup fue deshabilitado. Usar POST /api/admin/track-world-cup directamente.',
  })
}