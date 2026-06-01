import { NextRequest, NextResponse } from 'next/server'
import { NATIONAL_TEAMS } from '@/data/teams'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const AF_BASE = 'https://v3.football.api-sports.io'

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export async function GET(req: NextRequest) {
  const secretFromUrl = req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.SYNC_SECRET
  const apiKey = process.env.API_FOOTBALL_KEY

  if (!expectedSecret || secretFromUrl !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 500 })
  }

  const mapped = []
  const notFound = []

  for (const team of NATIONAL_TEAMS) {
    const search = team.displayName

    const res = await fetch(`${AF_BASE}/teams?search=${encodeURIComponent(search)}`, {
      headers: { 'x-apisports-key': apiKey },
      cache: 'no-store',
    })

    const data = await res.json()

    const nationalResults = (data?.response ?? [])
      .map((item: any) => item.team)
      .filter((apiTeam: any) => apiTeam?.national === true)

    const exact =
      nationalResults.find((apiTeam: any) => {
        return normalizeName(apiTeam.name) === normalizeName(team.displayName)
      }) ??
      nationalResults.find((apiTeam: any) => {
        return normalizeName(apiTeam.country ?? '') === normalizeName(team.displayName)
      }) ??
      nationalResults[0]

    if (exact?.id) {
      mapped.push({
        teamKey: team.teamKey,
        displayName: team.displayName,
        apiFootballId: exact.id,
        apiName: exact.name,
        apiCountry: exact.country,
      })
    } else {
      notFound.push({
        teamKey: team.teamKey,
        displayName: team.displayName,
        search,
        apiResults: nationalResults.map((apiTeam: any) => ({
          id: apiTeam.id,
          name: apiTeam.name,
          country: apiTeam.country,
          national: apiTeam.national,
        })),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    total: NATIONAL_TEAMS.length,
    mappedCount: mapped.length,
    notFoundCount: notFound.length,
    mapped,
    notFound,
  })
}