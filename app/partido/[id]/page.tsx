import { matches } from '@/data/matches'
import { processMatch } from '@/lib/processMatch'
import { notFound } from 'next/navigation'
import MatchScreen from './MatchScreen'

export default function PartidoPage({ params }: { params: { id: string } }) {
  const match = matches.find(m => m.id === params.id)
  if (!match) notFound()

  const processed = processMatch(match)

  return <MatchScreen match={match} processed={processed} />
}
