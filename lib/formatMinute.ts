import type { MatchPeriod } from '@/data/matches'

// ── Constantes de período ─────────────────────────────────────────────────

// Minuto absoluto en que empieza el reloj de cada período
const PERIOD_ABSOLUTE_START: Record<MatchPeriod, number> = {
  PT:  0,
  ST:  45,
  ET1: 90,
  ET2: 105,
}

// Duración "normal" de cada período (sin tiempo adicional)
const PERIOD_NORMAL_DURATION: Record<MatchPeriod, number> = {
  PT:  45,
  ST:  45,
  ET1: 15,
  ET2: 15,
}

// Base del display cuando hay tiempo adicional (ej: "45+N", "90+N", "105+N", "120+N")
const PERIOD_DISPLAY_BASE: Record<MatchPeriod, number> = {
  PT:  45,
  ST:  90,
  ET1: 105,
  ET2: 120,
}

// ── Funciones exportadas ──────────────────────────────────────────────────

/**
 * Convierte period + minuteInPeriod al minuto absoluto.
 * Usado en processMatch para validar coherencia vs el campo `minute`.
 *
 * Ejemplos:
 *   PT + 23  → 23
 *   PT + 47  → 47
 *   ST + 10  → 55
 *   ST + 47  → 92
 *   ET1 + 3  → 93
 *   ET2 + 1  → 106
 */
export function toAbsoluteMinute(period: MatchPeriod, minuteInPeriod: number): number {
  return PERIOD_ABSOLUTE_START[period] + minuteInPeriod
}

/**
 * Formatea un minuto de evento al display futbolero correcto.
 * Requiere period + minuteInPeriod para ser unambiguo.
 * Fallback a `"${fallbackAbsolute}'"` cuando no están disponibles.
 *
 * Regla uniforme para todos los períodos:
 *   mip <= normalDuration → minuto absoluto (ej: "23'", "80'", "105'", "118'")
 *   mip >  normalDuration → displayBase+extra (ej: "45+2'", "90+8'", "105+3'", "120+1'")
 *
 * Los cortes reales son 45 / 90 / 105 / 120.
 * El campo `period` del evento determina en qué tramo ocurrió el evento,
 * resolviendo la ambigüedad del minuto absoluto (ej: abs 106 puede ser ET1+16 o ET2+1).
 *
 * Ejemplos:
 *   PT  mip 23 → "23'"     ST  mip 35 → "80'"
 *   PT  mip 47 → "45+2'"   ST  mip 46 → "90+1'"
 *   ET1 mip 15 → "105'"    ET2 mip  1 → "106'"
 *   ET1 mip 16 → "105+1'"  ET2 mip 13 → "118'"
 *   ET1 mip 18 → "105+3'"  ET2 mip 16 → "120+1'"
 */
export function formatEventMinute(
  period: MatchPeriod | undefined,
  minuteInPeriod: number | undefined,
  fallbackAbsolute: number,
): string {
  if (period === undefined || minuteInPeriod === undefined) {
    return `${fallbackAbsolute}'`
  }

  const normalDuration = PERIOD_NORMAL_DURATION[period]
  const absoluteStart  = PERIOD_ABSOLUTE_START[period]
  const displayBase    = PERIOD_DISPLAY_BASE[period]

  if (minuteInPeriod <= normalDuration) {
    return `${absoluteStart + minuteInPeriod}'`
  } else {
    const extra = minuteInPeriod - normalDuration
    return `${displayBase}+${extra}'`
  }
}
