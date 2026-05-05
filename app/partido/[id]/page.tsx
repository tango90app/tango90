import { supabaseServer } from '@/lib/supabaseServer'
import { matches } from '@/data/matches'
import { processMatch } from '@/lib/processMatch'
import { notFound } from 'next/navigation'
import MatchScreen from './MatchScreen'
import { getTeamByApiFootballId, getTeamByKey } from '@/data/teams'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PartidoPage({ params }: { params: { id: string } }) {
  // 1. buscar en Supabase
const { data } = await supabaseServer
  .from('matches_api')
  .select('data')
  .eq('id', params.id)
  .maybeSingle()

let match = data?.data

// 2. fallback a hardcode
if (!match) {
  match = matches.find(m => m.id === params.id)
}
  if (!match) notFound()

const normalizeTeam = (team: any) => {
  const apiId = Number(String(team.id).replace('api-team-', ''))
  const mapped =
    Number.isFinite(apiId)
      ? getTeamByApiFootballId(apiId)
      : getTeamByKey(team.id)

  return {
    ...team,
    id: mapped?.teamKey ?? team.id,
    name: mapped?.displayName ?? team.name,
    shortName: mapped?.abbreviation ?? team.shortName,
    badge: mapped?.crestPath ?? team.badge,
  }
}

const normalizedMatch = {
  ...match,
  home: normalizeTeam(match.home),
  away: normalizeTeam(match.away),
}

const processed = processMatch(normalizedMatch)

  return <MatchScreen match={normalizedMatch} processed={processed} />
}
