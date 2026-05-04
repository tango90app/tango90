// ── Progreso de votación por partido ──────────────────────────────────────
//
// Funciones server-side que calculan qué entidades son votables en un partido
// y qué porcentaje ya votó un usuario dado.
//
// Importar SOLO desde código server-side (API routes).
// No marcar con 'use client'.

import { matches } from '@/data/matches'
import { processMatch } from './processMatch'

// ── Secciones votables ────────────────────────────────────────────────────

export type VotableSections = {
  /** target_ids (sin prefijo de partido) de jugadores elegibles + DT local */
  homeTargetIds:   string[]
  /** target_ids de jugadores elegibles + DT visitante */
  awayTargetIds:   string[]
  /** target_id del árbitro */
  refereeTargetId: string
  /** solo jugadores elegibles, sin DT — para desbloqueo del promedio del equipo */
  homePlayerIds:   string[]
  awayPlayerIds:   string[]
  homeTeamId:      string
  awayTeamId:      string
  homeTeamName:    string
  awayTeamName:    string
  /** total de entidades votables */
  total:           number
}

/**
 * Devuelve las secciones votables para un partido.
 * Retorna null si el partido no existe o no está terminado.
 * Usa processMatch como única fuente de verdad para elegibilidad.
 */
export function getVotableSections(matchId: string): VotableSections | null {
  const match = matches.find(m => m.id === matchId)
  if (!match || match.status !== 'finished') return null

  const processed = processMatch(match)

  const homePlayerIds = processed.home.players.filter(p => p.eligibleForVoting).map(p => p.id)
  const awayPlayerIds = processed.away.players.filter(p => p.eligibleForVoting).map(p => p.id)
  const homeTargetIds = [...homePlayerIds, processed.home.coach.id]
  const awayTargetIds = [...awayPlayerIds, processed.away.coach.id]

  return {
    homeTargetIds,
    awayTargetIds,
    homePlayerIds,
    awayPlayerIds,
    refereeTargetId: processed.referee.id,
    homeTeamId:      processed.home.id,
    awayTeamId:      processed.away.id,
    homeTeamName:    processed.home.name,
    awayTeamName:    processed.away.name,
    total:           homeTargetIds.length + awayTargetIds.length + 1,
  }
}

// ── Resultado de progreso ─────────────────────────────────────────────────

export type ProgressResult = {
  voted:        number
  total:        number
  homeComplete:        boolean   // jugadores + DT local ✓ → dispara placa de equipo
  awayComplete:        boolean   // jugadores + DT visitante ✓ → dispara placa de equipo
  allComplete:         boolean   // todo ✓ → dispara placa de partido
  homePlayersComplete: boolean   // solo jugadores locales ✓ → desbloquea promedio home
  awayPlayersComplete: boolean   // solo jugadores visitantes ✓ → desbloquea promedio away
  homeTeamId:   string
  awayTeamId:   string
  homeTeamName: string
  awayTeamName: string
}

/**
 * Calcula el progreso de un usuario dado sus votos ya emitidos.
 *
 * @param sections   Resultado de getVotableSections()
 * @param votedTargetIds  Lista de target_ids ya votados por este usuario (desde DB)
 */
export function computeProgress(
  sections: VotableSections,
  votedTargetIds: string[],
): ProgressResult {
  const votedSet = new Set(votedTargetIds)

  const homePlayersComplete = sections.homePlayerIds.every(id => votedSet.has(id))
  const awayPlayersComplete = sections.awayPlayerIds.every(id => votedSet.has(id))
  const homeComplete        = homePlayersComplete && votedSet.has(sections.homeTargetIds[sections.homeTargetIds.length - 1]) // last item = coach
  const awayComplete        = awayPlayersComplete && votedSet.has(sections.awayTargetIds[sections.awayTargetIds.length - 1])
  const refereeVoted        = votedSet.has(sections.refereeTargetId)
  const allComplete         = homeComplete && awayComplete && refereeVoted

  // Contar solo votos que corresponden a entidades votables del partido
  const allVotable = new Set([
    ...sections.homeTargetIds,
    ...sections.awayTargetIds,
    sections.refereeTargetId,
  ])
  const voted = votedTargetIds.filter(id => allVotable.has(id)).length

  return {
    voted,
    total:               sections.total,
    homeComplete,
    awayComplete,
    allComplete,
    homePlayersComplete,
    awayPlayersComplete,
    homeTeamId:          sections.homeTeamId,
    awayTeamId:          sections.awayTeamId,
    homeTeamName:        sections.homeTeamName,
    awayTeamName:        sections.awayTeamName,
  }
}
