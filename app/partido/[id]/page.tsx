import { supabaseServer } from '@/lib/supabaseServer'
import { matches } from '@/data/matches'
import { processMatch } from '@/lib/processMatch'
import { notFound } from 'next/navigation'
import MatchScreen from './MatchScreen'

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

  const processed = processMatch(match)

  return <MatchScreen match={match} processed={processed} />
}
