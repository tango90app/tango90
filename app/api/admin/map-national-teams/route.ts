import { NextRequest, NextResponse } from 'next/server'
import { NATIONAL_TEAMS } from '@/data/teams'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const AF_BASE = 'https://v3.football.api-sports.io'

const SEARCH_NAMES_BY_TEAM_KEY: Record<string, string> = {
  mex: 'Mexico',
  rsa: 'South Africa',
  kor: 'South Korea',
  cze: 'Czech Republic',
  can: 'Canada',
  sui: 'Switzerland',
  mar: 'Morocco',
  hai: 'Haiti',
  sco: 'Scotland',
  usa: 'USA',
  tur: 'Turkey',
  ger: 'Germany',
  cuw: 'Curacao',
  civ: 'Ivory Coast',
  ned: 'Netherlands',
  jpn: 'Japan',
  swe: 'Sweden',
  tun: 'Tunisia',
  bel: 'Belgium',
  egy: 'Egypt',
  irn: 'Iran',
  nzl: 'New Zealand',
  esp: 'Spain',
  ksa: 'Saudi Arabia',
  fra: 'France',
  irq: 'Iraq',
  nor: 'Norway',
  alg: 'Algeria',
  jor: 'Jordan',
  uzb: 'Uzbekistan',
  eng: 'England',
  cro: 'Croatia',
  pan: 'Panama',
  bra: 'Brazil',
  qat: 'Qatar',
  cpv: 'Cape Verde',
  cod: 'Congo DR',
  bih: 'Bosnia and Herzegovina',
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\./g, '')
    .trim()
}

function isBadCandidate(apiTeam: any) {
  const name = normalizeName(apiTeam?.name ?? '')

  return (
    name.includes('u20') ||
    name.includes('u21') ||
    name.includes('u23') ||
    name.includes('w') ||
    name.includes('women') ||
    name.includes('olympic')
  )
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
    const search = SEARCH_NAMES_BY_TEAM_KEY[team.teamKey] ?? team.displayName

    if (!['mex','cuw','jor','pan','swe','bih','qat','sui','nzl','nor'].includes(team.teamKey)) {
      continue
    }

    const res = await fetch(`${AF_BASE}/teams?search=${encodeURIComponent(search)}`, {
      headers: { 'x-apisports-key': apiKey },
      cache: 'no-store',
    })

    const data = await res.json()

    const nationalResults = (data?.response ?? [])
      .map((item: any) => item.team)
      .filter((apiTeam: any) => apiTeam?.national === true)
      .filter((apiTeam: any) => !isBadCandidate(apiTeam))

    const wanted = normalizeName(search)

    const exact =
      nationalResults.find((apiTeam: any) => normalizeName(apiTeam.name) === wanted) ??
      nationalResults.find((apiTeam: any) => normalizeName(apiTeam.country ?? '') === wanted) ??
      nationalResults[0]

    if (exact?.id) {
      mapped.push({
        teamKey: team.teamKey,
        displayName: team.displayName,
        search,
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