import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { getMatchPhase } from '@/lib/matchPhase'
import { getVotableSections, computeProgress } from '@/lib/voteProgress'
import { matches } from '@/data/matches'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── GET /api/votes/progress?match_id=x&anon_id=y ─────────────────────────
//
// Devuelve el progreso de votación de un usuario para un partido:
//   voted         — entidades ya votadas
//   total         — total de entidades votables
//   homeComplete  — equipo local completado
//   awayComplete  — equipo visitante completado
//   allComplete   — todo completado (incluye árbitro)
//   phase         — fase actual del partido
//   plaques       — placas ya obtenidas por este usuario para este partido
//
// Cargado por MatchScreen en el montaje inicial.

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const match_id = searchParams.get('match_id') ?? ''
  const anon_id  = searchParams.get('anon_id')  ?? ''

  if (!match_id || !anon_id) {
    return NextResponse.json(
      { error: 'match_id and anon_id are required' },
      { status: 400 }
    )
  }

  // Fase del partido
  const match = matches.find(m => m.id === match_id)
  const phase = match ? getMatchPhase(match.match_end_at).phase : 'not_available'

  // Secciones votables (null si el partido no está terminado o no existe)
  const sections = getVotableSections(match_id)
  if (!sections) {
    return NextResponse.json(
      {
        voted: 0, total: 0,
        homeComplete: false, awayComplete: false, allComplete: false,
        homeTeamId: '', awayTeamId: '', homeTeamName: '', awayTeamName: '',
        plaques: [],
        phase,
      },
      { headers: NO_CACHE }
    )
  }

  // Votos del usuario para este partido
  const { data: votes, error: votesError } = await supabaseServer
    .from('votes')
    .select('target_id')
    .eq('match_id', match_id)
    .eq('anon_id',  anon_id)

  if (votesError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const votedIds = (votes ?? []).map(v => v.target_id as string)
  const progress = computeProgress(sections, votedIds)

  // Placas del usuario para este partido
  const { data: plaquesData } = await supabaseServer
    .from('plaques')
    .select('type, team_id, created_at')
    .eq('anon_id',  anon_id)
    .eq('match_id', match_id)
    .order('created_at', { ascending: true })

  const plaques = (plaquesData ?? []).map(p => ({
    type:   p.type as 'team' | 'match',
    teamId: (p.team_id ?? undefined) as string | undefined,
  }))

  return NextResponse.json(
    { ...progress, plaques, phase },
    { headers: NO_CACHE }
  )
}

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma':        'no-cache',
}
