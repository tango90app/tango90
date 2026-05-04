/**
 * Devuelve el color correspondiente a un valor de calificación (1-10).
 * Para promedios, usar Math.floor(avg) antes de llamar a esta función.
 * Ej: promedio 8.2 → floor → 8 → verde fuerte
 *     promedio 6.9 → floor → 6 → gris
 */
export function getScoreColor(value: number): string {
  const v = Math.floor(value)
  if (v <= 1) return '#7f1d1d'  // 1  → rojo oscuro
  if (v <= 3) return '#ef4444'  // 2–3 → rojo
  if (v === 4) return '#f97316' // 4  → naranja
  if (v <= 6) return '#888888'  // 5–6 → gris
  if (v === 7) return '#86efac' // 7  → verde claro
  if (v <= 9) return '#22c55e'  // 8–9 → verde fuerte
  return '#F5A623'              // 10 → dorado (brand)
}
