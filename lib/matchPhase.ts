// ── Fases de votación basadas en match_end_at ──────────────────────────────
//
// Fases:
//   voting_open_blind  0 – 90 min post-partido: modo ciego (avg oculto pre-voto)
//   voting_open        90 min – 24h:            modo normal (avg visible)
//   voting_closed      > 24h:                   ventana cerrada
//   not_available      sin match_end_at, timestamp inválido, o partido no terminado aún
//
// Importable tanto en server (API routes) como en client ('use client' components).
// No tiene dependencias de Node ni de DOM.

export type VotingPhase =
  | 'voting_open_blind'
  | 'voting_open'
  | 'voting_closed'
  | 'not_available'

const BLIND_DURATION_MS = 90  * 60 * 1000        // 90 minutos
const VOTING_WINDOW_MS  = 24  * 60 * 60 * 1000   // 24 horas

export type PhaseResult = {
  phase:            VotingPhase
  elapsedMs:        number   // ms desde que terminó el partido
  remainingMs:      number   // ms hasta que cierra la ventana (0 si cerrado)
  blindRemainingMs: number   // ms hasta que termina el modo ciego (0 si ya pasó)
}

const EMPTY: PhaseResult = {
  phase: 'not_available', elapsedMs: 0, remainingMs: 0, blindRemainingMs: 0,
}

export function getMatchPhase(matchEndAt?: string | null): PhaseResult {
  if (!matchEndAt) return EMPTY

  const endTime = new Date(matchEndAt).getTime()
  if (isNaN(endTime)) return EMPTY

  const elapsedMs = Date.now() - endTime
  if (elapsedMs < 0) return EMPTY  // el partido aún no terminó según este timestamp

  if (elapsedMs >= VOTING_WINDOW_MS) {
    return { phase: 'voting_closed', elapsedMs, remainingMs: 0, blindRemainingMs: 0 }
  }

  const remainingMs = VOTING_WINDOW_MS - elapsedMs

  if (elapsedMs < BLIND_DURATION_MS) {
    return {
      phase:            'voting_open_blind',
      elapsedMs,
      remainingMs,
      blindRemainingMs: BLIND_DURATION_MS - elapsedMs,
    }
  }

  return { phase: 'voting_open', elapsedMs, remainingMs, blindRemainingMs: 0 }
}

/** true si la fase permite emitir votos */
export function canVote(phase: VotingPhase): boolean {
  return phase === 'voting_open_blind' || phase === 'voting_open'
}

/**
 * Formatea ms restantes como "Xh Ym" o "Xm".
 * Útil para mostrar "cierra en 22h 15m".
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMin = Math.ceil(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
