import type { Match, MatchEvent, MatchRules, MatchPeriods, MatchPeriod, Player, Position } from '@/data/matches'
import { formatEventMinute, toAbsoluteMinute } from './formatMinute'

// ── Duración real del partido ─────────────────────────────────────────────
// Fallback cuando el partido no tiene `periods` definido (mocks legacy)
const DEFAULT_MATCH_END_MINUTE = 90

// Umbral explícito para elegibilidad de voto: >= 5 minutos reales jugados
const VOTING_ELIGIBILITY_THRESHOLD_MINUTES = 5

// Retorna el minuto real de fin del partido.
// Toma el período más tardío que exista: ET2 > ET1 > ST.
// Si el partido no tiene `periods`, devuelve DEFAULT_MATCH_END_MINUTE (90).
function getMatchEndMinute(match: Match): number {
  const p = match.periods
  if (!p) return DEFAULT_MATCH_END_MINUTE
  return (
    p.extraTimeSecond?.endMinute ??
    p.extraTimeFirst?.endMinute ??
    p.secondHalf.endMinute
  )
}

// Minutos considerados "entretiempo" — sustituciones en este rango no cuentan como ventana nueva
// Cubre PT/ST (45-46) y ET1/ET2 (105-106)
const HALFTIME_MINUTES: ReadonlySet<number> = new Set([45, 46, 105, 106])

// ── Tipos de salida ───────────────────────────────────────────────────────

export type PlayerStatus =
  | 'starter_full'              // titular, jugó los 90'
  | 'starter_subbed_out'        // titular, fue sustituido
  | 'starter_red_card'          // titular, expulsado
  | 'sub_entered'               // suplente que ingresó y terminó el partido
  | 'sub_entered_subbed_out'    // suplente que ingresó y luego fue sustituido
  | 'sub_entered_red_card'      // suplente que ingresó y fue expulsado
  | 'sub_never_entered'         // suplente que no ingresó
  | 'sub_expelled_before_entry' // suplente expulsado antes de ingresar (ya no puede entrar)

export type ProcessedPlayer = {
  // ── Campos originales sin modificar ──
  id: string
  name: string
  number: number
  position: Position
  minutesPlayed: number         // valor manual legacy — intacto
  starter: boolean

  // ── Campos derivados ──
  derivedMinutesPlayed: number
  eligibleForVoting: boolean     // ver calcEligible() — depende de status y minutos
  status: PlayerStatus
  minuteIn: number | null       // minuto de ingreso (null si es titular — entró al 0')
  minuteOut: number | null      // minuto de salida (null si terminó el partido en cancha)
  minuteInDisplay: string | null   // display futbolero del ingreso, ej: "60'" o "45+2'"
  minuteOutDisplay: string | null  // display futbolero de la salida, ej: "78'" o "90+3'"
  goals: number
  yellowCards: number
  redCard: boolean
  inconsistencies: string[]     // diferencias detectadas entre minutesPlayed manual y derivado
}

export type SubstitutionWindow = {
  minute: number
  isHalftime: boolean
  subs: Array<{ playerOutId: string; playerInId: string }>
}

export type ProcessedTeam = {
  // ── Campos originales sin modificar ──
  id: string
  name: string
  shortName: string
  badge: string
  score: number
  coach: { id: string; name: string }

  // ── Players reemplazados por versión procesada ──
  players: ProcessedPlayer[]

  // ── Derivados de sustituciones ──
  validSubstitutions: number
  availableSubstitutionsLimit: number   // calculado desde match.rules
  substitutionWindows: SubstitutionWindow[]
  validWindowsUsed: number              // solo ventanas no-entretiempo
  availableWindowsLimit: number         // calculado desde match.rules
}

export type ValidationWarning = {
  severity: 'error' | 'warning'
  message: string
  playerId?: string
  eventIndex?: number
}

export type ProcessedMatch = {
  // ── Campos originales sin modificar ──
  id: string
  date: string
  time: string
  tournament: string
  round: string
  stadium: string
  status: 'live' | 'finished' | 'upcoming'
  referee: { id: string; name: string }
  rules: MatchRules
  periods?: MatchPeriods
  events: MatchEvent[]
  penaltyShootout?: import('@/data/matches').PenaltyShootout

  // ── Equipos reemplazados por versión procesada ──
  home: ProcessedTeam
  away: ProcessedTeam

  // ── Warnings de validación ──
  warnings: ValidationWarning[]
}

// ── Elegibilidad de voto por jugador ─────────────────────────────────────
// Única fuente de verdad. Los componentes leen ProcessedPlayer.eligibleForVoting
// y no recalculan nada.
//
// Reglas:
//   Titulares                    → siempre elegibles (arrancaron el partido)
//   Suplente que entró y terminó → solo si derivedMinutesPlayed >= threshold
//   Suplente que entró y salió   → siempre elegible (expulsión o sustitución)
//   Suplente sin ingreso         → nunca elegible (sin participación)
function calcEligible(status: PlayerStatus, derivedMinutesPlayed: number): boolean {
  switch (status) {
    case 'sub_never_entered':
    case 'sub_expelled_before_entry':
      return false

    case 'starter_full':
    case 'starter_subbed_out':
    case 'starter_red_card':
      return true

    case 'sub_entered':
      return derivedMinutesPlayed >= VOTING_ELIGIBILITY_THRESHOLD_MINUTES

    case 'sub_entered_subbed_out':
    case 'sub_entered_red_card':
      return true
  }
}

// ── Motor de procesamiento ────────────────────────────────────────────────

export function processMatch(match: Match): ProcessedMatch {
  const warnings: ValidationWarning[] = []
  const matchEnd = getMatchEndMinute(match)

  // Paso 1: construir índice global de jugadores (ambos equipos)
  const allPlayers = [...match.home.players, ...match.away.players]
  const playerMap = new Map<string, Player & { teamSide: 'home' | 'away' }>()
  for (const p of match.home.players) playerMap.set(p.id, { ...p, teamSide: 'home' })
  for (const p of match.away.players) playerMap.set(p.id, { ...p, teamSide: 'away' })

  // Paso 2: inicializar estado mutable por jugador
  type MutableState = {
    onField: boolean
    redCarded: boolean
    minuteIn: number | null
    minuteOut: number | null
    minuteInDisplay: string | null   // string pre-formateado para UI
    minuteOutDisplay: string | null  // string pre-formateado para UI
    goals: number
    yellowCards: number
    redCard: boolean
    subEntered: boolean
    subExpelledBeforeEntry: boolean
  }

  const state = new Map<string, MutableState>()
  for (const p of allPlayers) {
    state.set(p.id, {
      onField: p.starter,
      redCarded: false,
      minuteIn: p.starter ? null : undefined as unknown as null,
      minuteOut: null,
      minuteInDisplay: null,
      minuteOutDisplay: null,
      goals: 0,
      yellowCards: 0,
      redCard: false,
      subEntered: false,
      subExpelledBeforeEntry: false,
    })
  }
  // Para suplentes, minuteIn arranca como null hasta que ingresen
  for (const p of allPlayers) {
    if (!p.starter) {
      state.get(p.id)!.minuteIn = null
    }
  }

  // Acumuladores de sustituciones por equipo
  type SubEntry = { playerOutId: string; playerInId: string; minute: number }
  const homeSubs: SubEntry[] = []
  const awaySubs: SubEntry[] = []

  // Paso 3: ordenar eventos cronológicamente
  const sortedEvents = [...match.events].sort((a, b) => a.minute - b.minute)

  // Paso 4: procesar cada evento
  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i]

    // ── Validar que los playerIds referenciados existen ──────────────────
    if (event.type === 'goal' || event.type === 'yellow_card' || event.type === 'red_card') {
      if (!playerMap.has(event.playerId)) {
        warnings.push({
          severity: 'error',
          message: `Event ${event.type} at ${event.minute}' references unknown playerId "${event.playerId}"`,
          eventIndex: i,
        })
        continue
      }
    }
    if (event.type === 'substitution') {
      if (!playerMap.has(event.playerOutId)) {
        warnings.push({
          severity: 'error',
          message: `Substitution at ${event.minute}' references unknown playerOutId "${event.playerOutId}"`,
          eventIndex: i,
        })
        continue
      }
      if (!playerMap.has(event.playerInId)) {
        warnings.push({
          severity: 'error',
          message: `Substitution at ${event.minute}' references unknown playerInId "${event.playerInId}"`,
          eventIndex: i,
        })
        continue
      }
    }

    // ── Validar coherencia de period+minuteInPeriod vs minute ────────────
    // `minute` es la verdad lógica. Si period+minuteInPeriod están presentes
    // y no coinciden con el absoluto derivado, se genera warning (no se altera el flujo).
    if (event.period !== undefined && event.minuteInPeriod !== undefined) {
      const derivedAbsolute = toAbsoluteMinute(event.period, event.minuteInPeriod)
      if (derivedAbsolute !== event.minute) {
        warnings.push({
          severity: 'warning',
          message: `Event ${event.type} at minute ${event.minute}: period=${event.period} minuteInPeriod=${event.minuteInPeriod} derives absolute ${derivedAbsolute} — mismatch with minute field (minute field used for logic)`,
          eventIndex: i,
        })
      }
    }

    // ── Procesar según tipo ───────────────────────────────────────────────

    if (event.type === 'goal') {
      // EVENTO DE JUEGO — requiere estar en cancha y no haber sido expulsado
      const s = state.get(event.playerId)!
      const p = playerMap.get(event.playerId)!

      if (s.redCarded) {
        warnings.push({
          severity: 'error',
          message: `goal at ${event.minute}' is invalid: ${p.name} (${event.playerId}) had already been sent off`,
          playerId: event.playerId,
          eventIndex: i,
        })
      } else if (!s.onField) {
        warnings.push({
          severity: 'error',
          message: `goal at ${event.minute}' is invalid: ${p.name} (${event.playerId}) was not on the field`,
          playerId: event.playerId,
          eventIndex: i,
        })
      } else {
        s.goals += 1
      }
    }

    else if (event.type === 'substitution') {
      // EVENTO DE JUEGO — playerOut debe estar en cancha, playerIn no debe estarlo ni estar expulsado
      const sOut = state.get(event.playerOutId)!
      const sIn  = state.get(event.playerInId)!
      const pOut = playerMap.get(event.playerOutId)!
      const pIn  = playerMap.get(event.playerInId)!

      let valid = true

      if (!sOut.onField) {
        warnings.push({
          severity: 'error',
          message: `substitution at ${event.minute}' is invalid: ${pOut.name} (${event.playerOutId}) was not on the field`,
          playerId: event.playerOutId,
          eventIndex: i,
        })
        valid = false
      }
      if (sIn.onField) {
        warnings.push({
          severity: 'error',
          message: `substitution at ${event.minute}' is invalid: ${pIn.name} (${event.playerInId}) was already on the field`,
          playerId: event.playerInId,
          eventIndex: i,
        })
        valid = false
      }
      if (sIn.redCarded || sIn.subExpelledBeforeEntry) {
        warnings.push({
          severity: 'error',
          message: `substitution at ${event.minute}' is invalid: ${pIn.name} (${event.playerInId}) was previously sent off and cannot enter`,
          playerId: event.playerInId,
          eventIndex: i,
        })
        valid = false
      }

      if (valid) {
        // Calcular el display del minuto una sola vez para este evento
        const displayMinute = formatEventMinute(event.period, event.minuteInPeriod, event.minute)

        // Marcar jugador que sale
        sOut.onField         = false
        sOut.minuteOut       = event.minute
        sOut.minuteOutDisplay = displayMinute

        // Marcar jugador que entra
        sIn.onField        = true
        sIn.minuteIn       = event.minute
        sIn.minuteInDisplay = displayMinute
        sIn.subEntered     = true

        // Registrar sustitución en el equipo correspondiente
        const subEntry = { playerOutId: event.playerOutId, playerInId: event.playerInId, minute: event.minute }
        if (event.team === 'home') homeSubs.push(subEntry)
        else awaySubs.push(subEntry)
      }
    }

    else if (event.type === 'red_card') {
      // EVENTO DISCIPLINARIO — NO requiere estar en cancha
      // Puede ser titular en cancha, suplente en banco, o jugador ya sustituido
      const s = state.get(event.playerId)!
      const p = playerMap.get(event.playerId)!

      if (s.redCarded) {
        warnings.push({
          severity: 'warning',
          message: `${p.name} (${event.playerId}) already had a red card — duplicate red_card event at ${event.minute}'`,
          playerId: event.playerId,
          eventIndex: i,
        })
      } else {
        s.redCard   = true
        s.redCarded = true

        if (s.onField) {
          // Titular o suplente que ya había ingresado — sale de la cancha
          s.onField         = false
          s.minuteOut       = event.minute
          s.minuteOutDisplay = formatEventMinute(event.period, event.minuteInPeriod, event.minute)
        } else if (!p.starter && !s.subEntered) {
          // Suplente en el banco que aún no había ingresado — ya no puede entrar nunca
          s.subExpelledBeforeEntry = true
        }
        // Si ya había salido (sustituido), solo se marca redCard pero no afecta el campo
      }
    }

    else if (event.type === 'yellow_card') {
      // EVENTO DISCIPLINARIO — NO requiere estar en cancha
      const s = state.get(event.playerId)!
      s.yellowCards += 1
      // Nota: dos amarillas → roja directa es una regla adicional que se puede agregar después
    }
  }

  // Paso 5: derivar derivedMinutesPlayed y status para cada jugador

  // Calcula los minutos reales jugados sumando la intersección del jugador
  // con cada período del partido. Necesario porque los minutos absolutos
  // no son continuos entre períodos: PT puede terminar en 52 pero ST empieza en 46.
  // Sin esta función, un jugador que dispute todo el partido con prórroga
  // aparece con 124 en lugar de los ~140 minutos reales totales.
  //
  // PERIOD_BASES coincide con PERIOD_ABSOLUTE_START de formatMinute.ts.
  // Se duplica aquí para no cruzar imports entre módulos internos.
  function computePeriodAwareMinutes(
    absoluteIn: number,   // 0 para titulares, minuteIn para suplentes
    absoluteOut: number,  // minuteOut del evento, o matchEnd si terminó en cancha
  ): number {
    const periods = match.periods
    if (!periods) return absoluteOut - absoluteIn  // fallback: sin datos de período

    // Rangos de cada período en minutos absolutos: [base, endMinute]
    const ranges: Array<[number, number]> = [
      [0,   periods.firstHalf.endMinute],
      [45,  periods.secondHalf.endMinute],
      ...(periods.extraTimeFirst  ? [[90,  periods.extraTimeFirst.endMinute]] as Array<[number, number]> : []),
      ...(periods.extraTimeSecond ? [[105, periods.extraTimeSecond.endMinute]] as Array<[number, number]> : []),
    ]

    let total = 0
    for (const [start, end] of ranges) {
      const overlapStart = Math.max(absoluteIn, start)
      const overlapEnd   = Math.min(absoluteOut, end)
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart
    }
    return total
  }

  function buildProcessedPlayer(p: Player): ProcessedPlayer {
    const s = state.get(p.id)!
    const inconsistencies: string[] = []

    // Calcular derivedMinutesPlayed
    let derivedMinutesPlayed: number
    let status: PlayerStatus

    if (p.starter) {
      if (s.minuteOut !== null) {
        derivedMinutesPlayed = computePeriodAwareMinutes(0, s.minuteOut)
        status = s.redCard ? 'starter_red_card' : 'starter_subbed_out'
      } else {
        derivedMinutesPlayed = computePeriodAwareMinutes(0, matchEnd)
        status = 'starter_full'
      }
    } else {
      // Es suplente
      if (s.subExpelledBeforeEntry) {
        derivedMinutesPlayed = 0
        status = 'sub_expelled_before_entry'
      } else if (s.subEntered && s.minuteIn !== null) {
        const entered = s.minuteIn
        const exited  = s.minuteOut !== null ? s.minuteOut : matchEnd
        derivedMinutesPlayed = computePeriodAwareMinutes(entered, exited)
        if (s.redCard && s.minuteOut !== null) {
          status = 'sub_entered_red_card'
        } else if (s.minuteOut !== null && !s.redCard) {
          status = 'sub_entered_subbed_out'
        } else {
          status = 'sub_entered'
        }
      } else {
        derivedMinutesPlayed = 0
        status = 'sub_never_entered'
      }
    }

    // Detectar inconsistencias con el campo manual
    const diff = Math.abs(p.minutesPlayed - derivedMinutesPlayed)
    if (diff > 1) {
      inconsistencies.push(
        `manual minutesPlayed is ${p.minutesPlayed} but derived value is ${derivedMinutesPlayed} (difference: ${diff} min)`
      )
      // Ejemplo de mensaje: "player b4 received red card at 78 but manual minutesPlayed is 90"
      if (s.redCard && s.minuteOut !== null) {
        inconsistencies.push(
          `player ${p.id} received red card at ${s.minuteOut}' but manual minutesPlayed is ${p.minutesPlayed}`
        )
      }
    }

    return {
      // Campos originales
      id: p.id,
      name: p.name,
      number: p.number,
      position: p.position,
      minutesPlayed: p.minutesPlayed,
      starter: p.starter,
      // Campos derivados
      derivedMinutesPlayed,
      eligibleForVoting: calcEligible(status, derivedMinutesPlayed),
      status,
      minuteIn: p.starter ? null : (s.minuteIn ?? null),
      minuteOut: s.minuteOut,
      // Display pre-formateado — fallback al absoluto si no hay period+minuteInPeriod
      minuteInDisplay:  !p.starter && s.minuteIn  !== null  ? (s.minuteInDisplay  ?? `${s.minuteIn}'`)  : null,
      minuteOutDisplay: s.minuteOut !== null                 ? (s.minuteOutDisplay ?? `${s.minuteOut}'`) : null,
      goals: s.goals,
      yellowCards: s.yellowCards,
      redCard: s.redCard,
      inconsistencies,
    }
  }

  // Paso 6: construir ventanas de sustitución
  function buildWindows(subs: SubEntry[]): SubstitutionWindow[] {
    const byMinute = new Map<number, SubEntry[]>()
    for (const sub of subs) {
      if (!byMinute.has(sub.minute)) byMinute.set(sub.minute, [])
      byMinute.get(sub.minute)!.push(sub)
    }
    return Array.from(byMinute.entries())
      .sort(([a], [b]) => a - b)
      .map(([minute, entries]) => ({
        minute,
        isHalftime: HALFTIME_MINUTES.has(minute),
        subs: entries.map(e => ({ playerOutId: e.playerOutId, playerInId: e.playerInId })),
      }))
  }

  // Paso 7: calcular límites disponibles según rules + conmoción del equipo
  function calcLimits(rules: MatchRules, teamSide: 'home' | 'away') {
    const concussionExtra = rules.concussionSubsEnabled
      ? (teamSide === 'home' ? rules.concussionSubsUsedHome : rules.concussionSubsUsedAway)
      : 0
    const subsLimit = rules.normalSubstitutionsLimit +
      (rules.extraTimeEnabled ? rules.extraTimeAdditionalSubs : 0) +
      concussionExtra
    const windowsLimit = rules.normalWindowsLimit +
      (rules.extraTimeEnabled ? rules.extraTimeAdditionalWindow : 0)
    return { subsLimit, windowsLimit }
  }

  // Paso 8: construir equipo procesado
  function buildTeam(
    team: typeof match.home,
    subs: SubEntry[],
    rules: MatchRules,
    teamSide: 'home' | 'away'
  ): ProcessedTeam {
    const processedPlayers = team.players.map(buildProcessedPlayer)
    const windows          = buildWindows(subs)
    const validWindowsUsed = windows.filter(w => !w.isHalftime).length
    const { subsLimit, windowsLimit } = calcLimits(rules, teamSide)

    if (subs.length > subsLimit) {
      warnings.push({
        severity: 'error',
        message: `${team.name} used ${subs.length} substitutions but limit is ${subsLimit}`,
      })
    }
    if (validWindowsUsed > windowsLimit) {
      warnings.push({
        severity: 'error',
        message: `${team.name} used ${validWindowsUsed} substitution windows but limit is ${windowsLimit}`,
      })
    }

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      badge: team.badge,
      score: team.score,
      coach: team.coach,
      players: processedPlayers,
      validSubstitutions: subs.length,
      availableSubstitutionsLimit: subsLimit,
      substitutionWindows: windows,
      validWindowsUsed,
      availableWindowsLimit: windowsLimit,
    }
  }

  // Paso 9: detectar inconsistencias de minutos en warnings globales
  for (const p of allPlayers) {
    const processed = state.get(p.id)!
    // Los inconsistencies ya se agregan dentro de buildProcessedPlayer
    // Aquí agregamos warnings globales para visibilidad en el array de match
    const s = processed
    if (s.redCarded && s.minuteOut !== null) {
      const expected = s.minuteOut
      if (Math.abs(p.minutesPlayed - expected) > 1) {
        warnings.push({
          severity: 'warning',
          message: `player ${p.id} (${p.name}) received red card at ${expected}' but manual minutesPlayed is ${p.minutesPlayed}`,
          playerId: p.id,
        })
      }
    }
  }

  return {
    id: match.id,
    date: match.date,
    time: match.time,
    tournament: match.tournament,
    round: match.round,
    stadium: match.stadium,
    status: match.status,
    referee: match.referee,
    rules: match.rules,
    periods: match.periods,
    events: match.events,
    penaltyShootout: match.penaltyShootout,
    home: buildTeam(match.home, homeSubs, match.rules, 'home'),
    away: buildTeam(match.away, awaySubs, match.rules, 'away'),
    warnings,
  }
}

// ── Helper de entidades votables ──────────────────────────────────────────
// Devuelve los entityIds de todos los votables de un partido terminado.
// Usado por el home (MatchStatusBadge) para calcular estado de votación.
// Centralizado aquí para que no haya lógica de elegibilidad fuera del procesador.
export function getVotableEntityIds(processed: ProcessedMatch): string[] {
  const playerIds = [
    ...processed.home.players,
    ...processed.away.players,
  ]
    .filter(p => p.eligibleForVoting)
    .map(p => `${processed.id}_${p.id}`)

  // DT y árbitro siempre votables cuando el partido terminó
  const dtIds = [
    `${processed.id}_${processed.home.coach.id}`,
    `${processed.id}_${processed.away.coach.id}`,
  ]
  const refereeId = `${processed.id}_${processed.referee.id}`

  return [...playerIds, ...dtIds, refereeId]
}
