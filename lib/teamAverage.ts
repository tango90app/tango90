// ── Promedio ponderado de equipo ──────────────────────────────────────────
//
// Fórmula:
//   promedio_equipo = Σ(avg_i × impactMinutes_i) / Σ(impactMinutes_i)
//
// Denominador: suma de impactMinutes de los jugadores que entraron en el
// cálculo (no un valor fijo como matchEnd × 11).
//
// Condición de visibilidad (se verifica en el caller, no aquí):
//   Solo se calcula cuando el usuario completó todos los jugadores votables
//   del equipo (homePlayersComplete / awayPlayersComplete = true).
//
// Incluye: titulares y suplentes votables.
// NO incluye: DT, árbitro.
// Importable tanto en server como en client.

export type PlayerForAverage = {
  id:            string
  impactMinutes: number
}

/**
 * Calcula el promedio ponderado del equipo.
 *
 * @param players        Jugadores votables del equipo (sin DT).
 * @param avgByPlayerId  Mapa { playerId → promedio global (todos los usuarios) | null }.
 * @returns              Promedio ponderado, o null si no hay datos suficientes.
 */
export function computeTeamAverage(
  players: PlayerForAverage[],
  avgByPlayerId: Record<string, number | null>,
): number | null {
  // Solo jugadores con promedio real disponible (al menos 1 voto en DB)
  const withVotes = players.filter(p => avgByPlayerId[p.id] != null)
  if (withVotes.length === 0) return null

  const sumWeighted = withVotes.reduce(
    (acc, p) => acc + avgByPlayerId[p.id]! * p.impactMinutes,
    0
  )
  const sumImpact = withVotes.reduce(
    (acc, p) => acc + p.impactMinutes,
    0
  )

  if (sumImpact === 0) return null
  return sumWeighted / sumImpact
}
