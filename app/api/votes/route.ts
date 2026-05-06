import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { getMatchPhase, canVote } from '@/lib/matchPhase'
import { getVotableSections, computeProgress, type ProgressResult } from '@/lib/voteProgress'
import { matches, type Match } from '@/data/matches'

export const runtime = 'nodejs'

// ── Tipos exportados ──────────────────────────────────────────────────────

export type PlaqueMeta = {
  type:      'team' | 'match'
  teamId?:   string
  teamName?: string
}

export type VoteResponse = {
  ok:         boolean
  progress:   ProgressResult | null
  newPlaques: PlaqueMeta[]
}

type Body = {
  match_id:    string
  target_type: 'player' | 'coach' | 'referee'
  target_id:   string
  score:       number
  anon_id:     string
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { match_id, target_type, target_id, score, anon_id } = body

  // ── Validación de campos ──────────────────────────────────────────────
  if (!match_id || typeof match_id !== 'string') {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }
  if (!['player', 'coach', 'referee'].includes(target_type)) {
    return NextResponse.json({ error: 'target_type must be player, coach, or referee' }, { status: 400 })
  }
  if (!target_id || typeof target_id !== 'string') {
    return NextResponse.json({ error: 'target_id is required' }, { status: 400 })
  }
  if (typeof score !== 'number' || score < 1 || score > 10 || !Number.isInteger(score)) {
    return NextResponse.json({ error: 'score must be an integer between 1 and 10' }, { status: 400 })
  }
  if (!anon_id || typeof anon_id !== 'string' || anon_id.length < 8) {
    return NextResponse.json({ error: 'anon_id is required' }, { status: 400 })
  }

  // ── Validación de fase ────────────────────────────────────────────────
  // Buscar primero en Supabase
const { data: matchRow } = await supabaseServer
  .from('matches_api')
  .select('data')
  .eq('id', match_id)
  .maybeSingle()

let match: Match | undefined = matchRow?.data

// Fallback a data local
if (!match) {
  match = matches.find(m => m.id === match_id)
}

if (!match) {
  return NextResponse.json({ error: 'Match not found' }, { status: 404 })
}
  if (match.status !== 'finished') {
    return NextResponse.json(
      { error: 'Cannot vote on a match that is not finished', code: 'MATCH_NOT_FINISHED' },
      { status: 422 }
    )
  }

  const { phase } = getMatchPhase(match.match_end_at)
  if (!canVote(phase)) {
    const code = phase === 'voting_closed' ? 'VOTING_CLOSED' : 'VOTING_NOT_OPEN'
    return NextResponse.json(
      { error: 'Voting is not available for this match', code },
      { status: 422 }
    )
  }

  // ── Deduplicación ─────────────────────────────────────────────────────
  const { data: existing, error: checkError } = await supabaseServer
    .from('votes')
    .select('id')
    .eq('match_id',    match_id)
    .eq('target_type', target_type)
    .eq('target_id',   target_id)
    .eq('anon_id',     anon_id)
    .maybeSingle()

  if (checkError) {
    console.error('[votes POST] duplicate check error:', checkError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ error: 'Already voted', code: 'DUPLICATE' }, { status: 409 })
  }

  // ── Insertar voto ─────────────────────────────────────────────────────
  const { error: insertError } = await supabaseServer
    .from('votes')
    .insert({ match_id, target_type, target_id, score, anon_id })

  if (insertError) {
    console.error('[votes POST] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 })
  }

  // ── Progreso + Placas ─────────────────────────────────────────────────
  // El voto ya está guardado. Si falla el cálculo, devolvemos ok igualmente.
  try {
    const match = matches.find(m => m.id === match_id)

const sections = match ? getVotableSections(match) : null
    if (!sections) {
      return NextResponse.json({ ok: true, progress: null, newPlaques: [] }, { status: 201 })
    }

    const { data: allVotes } = await supabaseServer
      .from('votes')
      .select('target_id')
      .eq('match_id', match_id)
      .eq('anon_id',  anon_id)

    const votedIds = (allVotes ?? []).map(v => v.target_id as string)
    const progress = computeProgress(sections, votedIds)
    const newPlaques = await detectAndInsertPlaques(anon_id, match_id, progress, sections)

    return NextResponse.json({ ok: true, progress, newPlaques }, { status: 201 })
  } catch (err) {
    console.error('[votes POST] progress/plaques error:', err)
    return NextResponse.json({ ok: true, progress: null, newPlaques: [] }, { status: 201 })
  }
}

// ── Helper: detectar y persistir placas ──────────────────────────────────
//
// Reglas de negocio:
//   - Placa de equipo: SOLO UNA por usuario+partido.
//     Corresponde al primer equipo completado.
//     Si ya existe una, no se crea otra aunque se complete el segundo equipo.
//   - Placa de partido: una vez que ambos equipos + árbitro están completos.
//
// Dos capas de protección contra duplicados:
//   1. Lógica de app: verifica existencia antes de insertar.
//   2. DB: UNIQUE INDEX (anon_id, match_id, type) — cubre race conditions.

async function detectAndInsertPlaques(
  anon_id:  string,
  match_id: string,
  progress: ProgressResult,
  sections: Pick<ProgressResult, 'homeTeamId' | 'awayTeamId' | 'homeTeamName' | 'awayTeamName'>
): Promise<PlaqueMeta[]> {
  const { data: existing, error: fetchError } = await supabaseServer
    .from('plaques')
    .select('type, team_id')
    .eq('anon_id',  anon_id)
    .eq('match_id', match_id)

  if (fetchError) {
    // Muy probablemente la tabla no existe — la migración no fue ejecutada.
    console.error('[plaques] fetch existing error:', fetchError.message, fetchError.code)
    return []
  }

  const hasTeamPlaque  = existing.some(p => p.type === 'team')
  const hasMatchPlaque = existing.some(p => p.type === 'match')

  const newPlaques: PlaqueMeta[] = []

  // Placa de equipo — solo si no existe ninguna todavía
  if (!hasTeamPlaque) {
    let teamId:   string | null = null
    let teamName: string | null = null

    if (progress.homeComplete) {
      teamId   = sections.homeTeamId
      teamName = sections.homeTeamName
    } else if (progress.awayComplete) {
      teamId   = sections.awayTeamId
      teamName = sections.awayTeamName
    }

    if (teamId) {
      const { error } = await supabaseServer
        .from('plaques')
        .insert({ anon_id, match_id, type: 'team', team_id: teamId })

      if (!error) {
        newPlaques.push({ type: 'team', teamId, teamName: teamName! })
      } else if (error.code !== '23505') {
        // 23505 = unique_violation (race condition aceptable), cualquier otro error es inesperado
        console.error('[plaques] insert team error:', error.message, error.code)
      }
    }
  }

  // Placa de partido — ambos equipos + árbitro completos
  if (!hasMatchPlaque && progress.allComplete) {
    const { error } = await supabaseServer
      .from('plaques')
      .insert({ anon_id, match_id, type: 'match', team_id: null })

    if (!error) {
      newPlaques.push({ type: 'match' })
    } else if (error.code !== '23505') {
      console.error('[plaques] insert match error:', error.message, error.code)
    }
  }

  return newPlaques
}
