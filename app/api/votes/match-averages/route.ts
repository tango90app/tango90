import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { getVotableSections, computeProgress } from '@/lib/voteProgress'
import { matches } from '@/data/matches'
import { processMatch } from '@/lib/processMatch'
import { computeTeamAverage } from '@/lib/teamAverage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── GET /api/votes/match-averages?match_id=x&anon_id=y ───────────────────
//
// Devuelve para un partido completo:
//   byTarget  — por cada entidad votable: { avg, count, myVote }
//   homeTeamAvg — promedio ponderado del equipo local  (null si no desbloqueado)
//   awayTeamAvg — promedio ponderado del equipo visitante (null si no desbloqueado)
//
// Condición de desbloqueo del promedio de equipo:
//   El usuario completó todos los jugadores votables de ese equipo (sin DT).
//   Se verifica con homePlayersComplete / awayPlayersComplete.
//
// Cargado por MatchScreen al montar y después de cada voto.

export type EntityAverage = {
  avg:    number | null
  count:  number
  myVote: number | null
}

export type MatchAveragesResponse = {
  byTarget:    Record<string, EntityAverage>
  homeTeamAvg: number | null
  awayTeamAvg: number | null
}

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const match_id = searchParams.get('match_id') ?? ''
  const anon_id  = searchParams.get('anon_id')  ?? ''

  if (!match_id || !anon_id) {
    return NextResponse.json({ error: 'match_id and anon_id are required' }, { status: 400 })
  }

  const sections = getVotableSections(match_id)
  if (!sections) {
    return NextResponse.json<MatchAveragesResponse>(
      { byTarget: {}, homeTeamAvg: null, awayTeamAvg: null },
      { headers: NO_CACHE }
    )
  }

  // ── Fetch todos los votos del partido (para promedios globales) ──────
  const { data: allVotes, error: allVotesError } = await supabaseServer
    .from('votes')
    .select('target_id, score, anon_id')
    .eq('match_id', match_id)

  if (allVotesError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const rows = allVotes ?? []

  // ── Construir byTarget ───────────────────────────────────────────────
  // Por cada target_id: acumular sum/count de todos los usuarios, y el voto propio.
  const byTarget: Record<string, EntityAverage> = {}

  for (const row of rows) {
    const tid = row.target_id as string
    if (!byTarget[tid]) byTarget[tid] = { avg: null, count: 0, myVote: null }
    const e = byTarget[tid]
    e.count += 1
    e.avg = e.avg === null ? (row.score as number) : e.avg + (row.score as number)
    if (row.anon_id === anon_id) {
      e.myVote = row.score as number
    }
  }

  // Convertir la suma acumulada en promedio real
  for (const e of Object.values(byTarget)) {
    if (e.count > 0 && e.avg !== null) {
      e.avg = e.avg / e.count
    }
  }

  // ── Promedio del equipo ponderado ────────────────────────────────────
  // Solo se devuelve si el usuario completó todos los jugadores del equipo.
  const votedIds   = rows.filter(r => r.anon_id === anon_id).map(r => r.target_id as string)
  const progress   = computeProgress(sections, votedIds)

  const match = matches.find(m => m.id === match_id)!
  const processed = processMatch(match)

  // Construir mapa id → avg para jugadores
  const avgById: Record<string, number | null> = {}
  for (const [tid, e] of Object.entries(byTarget)) {
    avgById[tid] = e.avg
  }

  const homeTeamAvg = progress.homePlayersComplete
    ? computeTeamAverage(
        processed.home.players.filter(p => p.eligibleForVoting),
        avgById,
      )
    : null

  const awayTeamAvg = progress.awayPlayersComplete
    ? computeTeamAverage(
        processed.away.players.filter(p => p.eligibleForVoting),
        avgById,
      )
    : null

  return NextResponse.json<MatchAveragesResponse>(
    { byTarget, homeTeamAvg, awayTeamAvg },
    { headers: NO_CACHE }
  )
}
