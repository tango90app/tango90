// ── API-Football raw → Match interno ─────────────────────────────────────
//
// Transforma el JSON crudo de `api_football_raw_fixtures` al tipo Match.
//
// Decisiones de producto v1:
//   - minutesPlayed: nominal. FT → 90, AET/PEN → 120. Sin stoppage time.
//   - events.minute: absoluto (elapsed + extra). Igual que processMatch lo espera.
//   - events.period + minuteInPeriod: poblados para display futbolero ("45+2'", "90+8'").
//   - No se usan statistics.games.minutes (inconsistentes con descuentos).
//   - No se usan periods reales (API-Football no los provee).

import type { Match, Team, Player, MatchEvent, MatchRules, MatchPeriod, Position } from '@/data/matches'

// ── Tipos del raw de API-Football ─────────────────────────────────────────

type AFFixtureDetail = {
  id:      number
  date:    string
  referee: string | null
  venue:   { id: number; name: string; city: string } | null
  status:  { short: string; elapsed: number | null }
}

type AFLeague  = { id: number; name: string; round: string }
type AFTeamMeta = { id: number; name: string; logo: string }
type AFGoals   = { home: number | null; away: number | null }

type AFFixtureResponse = {
  fixture: AFFixtureDetail
  league:  AFLeague
  teams:   { home: AFTeamMeta; away: AFTeamMeta }
  goals:   AFGoals
}

type AFPlayerEntry = {
  player: { id: number; name: string; number: number; pos: string | null; grid: string | null }
  statistics: Array<{ games: { minutes: number | null; rating: string | null } }>
}

type AFLineupResponse = {
  team:        { id: number; name: string }
  coach:       { id: number; name: string }
  formation:   string
  startXI:     AFPlayerEntry[]
  substitutes: AFPlayerEntry[]
}

type AFEventResponse = {
  time:     { elapsed: number; extra: number | null }
  team:     { id: number; name: string }
  player:   { id: number | null; name: string | null }
  assist:   { id: number | null; name: string | null }
  type:     string    // "Goal" | "Card" | "subst" | "Var"
  detail:   string    // "Normal Goal" | "Own Goal" | "Penalty" | "Yellow Card" | ...
  comments: string | null
}

// ── Tipo real de la fila de Supabase ──────────────────────────────────────

export type RawFixtureRow = {
  provider:            string
  external_fixture_id: number
  internal_match_id:   string
  raw_fixture:         { response: AFFixtureResponse[] }
  raw_events:          { response: AFEventResponse[]  }
  raw_lineups:         { response: AFLineupResponse[] }
  sync_status:         string
  synced_at:           string
  created_at:          string
  updated_at:          string
}

// ── Helpers de IDs ────────────────────────────────────────────────────────

const playerId = (id: number) => `api-${id}`
const coachId  = (id: number) => `api-coach-${id}`
const refId    = (fixtureId: number) => `api-ref-${fixtureId}`

// ── Duración nominal del partido ──────────────────────────────────────────
// FT → 90, AET / PEN → 120. No se usa elapsed ni stoppage time.

function matchDuration(statusShort: string): 90 | 120 {
  return ['AET', 'PEN'].includes(statusShort) ? 120 : 90
}

// ── Status interno ────────────────────────────────────────────────────────

function afStatusToInternal(short: string): Match['status'] {
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished'
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live'
  return 'upcoming'
}

// ── Posiciones ────────────────────────────────────────────────────────────

function mapPosition(afPos: string | null | undefined): Position {
  switch (afPos?.toUpperCase()) {
    case 'G': return 'ARQ'
    case 'D': return 'DFC'
    case 'M': return 'MC'
    case 'F': return 'DEL'
    default:  return 'MC'
  }
}

// ── Period + minuteInPeriod desde elapsed + extra de API-Football ─────────
//
// API-Football usa elapsed como el minuto absoluto en el que ocurrió el evento
// (misma escala que processMatch). El campo extra existe solo cuando el evento
// ocurrió en stoppage time, e indica cuántos minutos adicionales lleva ese período.
//
// Mapeo elapsed → period:
//   1–45   → PT   (minuteInPeriod = elapsed)
//   46–90  → ST   (minuteInPeriod = elapsed - 45)
//   91–105 → ET1  (minuteInPeriod = elapsed - 90)
//   106–120→ ET2  (minuteInPeriod = elapsed - 105)
//
// Cuando hay extra:
//   El evento ocurrió en stoppage time del período.
//   minuteInPeriod = normalDuration + extra
//   minute (absoluto) = PERIOD_ABSOLUTE_START + minuteInPeriod
//
// Ejemplos:
//   elapsed=45, extra=3  → PT, mip=48, minute=48   → display "45+3'"
//   elapsed=90, extra=7  → ST, mip=52, minute=97   → display "90+7'"
//   elapsed=90, extra=0  → ST, mip=45, minute=90   → display "90'"
//   elapsed=105,extra=2  → ET1,mip=17, minute=107  → display "105+2'"

type PeriodInfo = {
  period:         MatchPeriod
  minuteInPeriod: number
  minute:         number    // absoluto — lo usa processMatch para lógica
}

function toPeriodInfo(elapsed: number, extra: number | null): PeriodInfo {
  const ex = extra ?? 0

  let period: MatchPeriod
  let base: number          // PERIOD_ABSOLUTE_START
  let normalDuration: number

  if (elapsed <= 45) {
    period = 'PT'; base = 0;   normalDuration = 45
  } else if (elapsed <= 90) {
    period = 'ST'; base = 45;  normalDuration = 45
  } else if (elapsed <= 105) {
    period = 'ET1'; base = 90; normalDuration = 15
  } else {
    period = 'ET2'; base = 105; normalDuration = 15
  }

  // Si hay extra, el evento ocurrió en stoppage time del período:
  //   minuteInPeriod = normalDuration + extra
  // Si no hay extra, el evento ocurrió dentro del tiempo normal:
  //   minuteInPeriod = elapsed - base
  const minuteInPeriod = ex > 0 ? normalDuration + ex : elapsed - base
  const minute         = base + minuteInPeriod

  return { period, minuteInPeriod, minute }
}

// ── Jugadores ─────────────────────────────────────────────────────────────
//
// minutesPlayed nominal: los titulares arrancan con `duration`, los suplentes
// con 0. processMatch recalcula `derivedMinutesPlayed` desde los eventos de
// sustitución — ese valor es el que usa para elegibilidad y ponderación.
// El campo `minutesPlayed` en Player es solo el dato de entrada manual;
// el sistema detectará cualquier inconsistencia pero seguirá funcionando.

function buildPlayers(lineup: AFLineupResponse, duration: 90 | 120): Player[] {
  const starters = lineup.startXI.map(e => ({
    id:            playerId(e.player.id),
    name:          e.player.name,
    number:        e.player.number ?? 0,
    position:      mapPosition(e.player.pos),
    minutesPlayed: duration,   // nominal: si fue suplido, processMatch lo ajusta
    starter:       true,
  }))

  const subs = lineup.substitutes.map(e => ({
    id:            playerId(e.player.id),
    name:          e.player.name,
    number:        e.player.number ?? 0,
    position:      mapPosition(e.player.pos),
    minutesPlayed: 0,          // nominal: processMatch calcula desde el evento subst
    starter:       false,
  }))

  return [...starters, ...subs]
}

// ── Eventos ───────────────────────────────────────────────────────────────

function buildEvents(afEvents: AFEventResponse[], homeTeamId: number): MatchEvent[] {
  const events: MatchEvent[] = []

  for (const ev of afEvents) {
    const { period, minuteInPeriod, minute } = toPeriodInfo(ev.time.elapsed, ev.time.extra)
    const team = ev.team.id === homeTeamId ? 'home' as const : 'away' as const

    if (ev.type === 'Goal') {
      const scorerId = ev.player.id
      if (!scorerId) continue

      const isOwn = ev.detail?.toLowerCase().includes('own goal')
      const isPen = ev.detail?.toLowerCase().includes('penalty')

      events.push({
        type:     'goal',
        playerId: playerId(scorerId),
        minute,
        period,
        minuteInPeriod,
        team,
        ...(isOwn         ? { isOwnGoal: true } : {}),
        ...(isPen         ? { isPenalty: true  } : {}),
        ...(ev.assist?.id ? { assistId: playerId(ev.assist.id) } : {}),
      } as MatchEvent)

    } else if (ev.type === 'Card') {
      const pid = ev.player.id
      if (!pid) continue

      if (ev.detail === 'Yellow Card') {
        events.push({ type: 'yellow_card', playerId: playerId(pid), minute, period, minuteInPeriod, team })
      } else if (ev.detail === 'Red Card') {
        events.push({ type: 'red_card', playerId: playerId(pid), minute, period, minuteInPeriod, team })
      } else if (ev.detail === 'Yellow Red Card') {
        events.push({ type: 'red_card', playerId: playerId(pid), minute, period, minuteInPeriod, team, isDoubleYellow: true } as MatchEvent)
      }

    } else if (ev.type === 'subst') {
      // API-Football: player = sale, assist = entra
      const outId = ev.player.id
      const inId  = ev.assist.id
      if (!outId || !inId) continue

      events.push({
        type:        'substitution',
        playerOutId: playerId(outId),
        playerInId:  playerId(inId),
        minute,
        period,
        minuteInPeriod,
        team,
      })
    }
    // Var y otros: ignorados intencionalmente
  }

  return events.sort((a, b) => a.minute - b.minute)
}

// ── Round display ─────────────────────────────────────────────────────────

function formatRound(raw: string): string {
  const seasonMatch = raw.match(/season\s*-\s*(\d+)/i)
  if (seasonMatch) return `Fecha ${seasonMatch[1]}`
  const dashMatch = raw.match(/^[^-]+-\s*(\d+)$/)
  if (dashMatch) return `Fecha ${dashMatch[1]}`
  return raw
}

// ── Árbitro ───────────────────────────────────────────────────────────────

function parseRefereeName(raw: string | null): string {
  if (!raw) return 'Árbitro'
  return raw.split(',')[0].trim()
}

// ── Rules por defecto ─────────────────────────────────────────────────────

function defaultRules(): MatchRules {
  return {
    normalSubstitutionsLimit:  5,
    normalWindowsLimit:        3,
    extraTimeEnabled:          false,
    extraTimeAdditionalSubs:   1,
    extraTimeAdditionalWindow: 1,
    concussionSubsEnabled:     false,
    concussionSubsUsedHome:    0,
    concussionSubsUsedAway:    0,
  }
}

// ── Transformer principal ─────────────────────────────────────────────────

export function buildMatchFromRaw(row: RawFixtureRow): Match {
  const fixtureData = row.raw_fixture?.response?.[0]
  if (!fixtureData) {
    throw new Error(`raw_fixture.response[0] vacío para fixture ${row.external_fixture_id}`)
  }

  const { fixture: fx, league, teams, goals } = fixtureData
  const afEvents  = row.raw_events?.response  ?? []
  const afLineups = row.raw_lineups?.response ?? []

  if (afLineups.length < 2) {
    throw new Error(
      `Lineups insuficientes para fixture ${row.external_fixture_id}: ` +
      `se necesitan 2, hay ${afLineups.length}. ` +
      `Solo disponibles una vez que el partido empezó.`
    )
  }

  const homeLineup = afLineups.find(l => l.team.id === teams.home.id)
  const awayLineup = afLineups.find(l => l.team.id === teams.away.id)

  if (!homeLineup || !awayLineup) {
    throw new Error(
      `No se pudo hacer match de lineups para fixture ${row.external_fixture_id}. ` +
      `IDs en lineups: ${afLineups.map(l => l.team.id).join(', ')}. ` +
      `Expected home=${teams.home.id}, away=${teams.away.id}.`
    )
  }

  const status   = afStatusToInternal(fx.status.short)
  const duration = matchDuration(fx.status.short)

  const dateObj = new Date(fx.date)
  const date    = fx.date.slice(0, 10)
  const time    = dateObj.toTimeString().slice(0, 5)

  // match_end_at: fecha + duración nominal. No usa elapsed ni stoppage time.
  let match_end_at: string | undefined
  if (status === 'finished') {
    match_end_at = new Date(dateObj.getTime() + duration * 60 * 1000).toISOString()
  }

  const homeTeam: Team = {
    id:        `api-team-${teams.home.id}`,
    name:      teams.home.name,
    shortName: teams.home.name.slice(0, 3).toUpperCase(),
    badge:     '🏟️',
    score:     goals.home ?? 0,
    players:   buildPlayers(homeLineup, duration),
    coach:     { id: coachId(homeLineup.coach.id), name: homeLineup.coach.name },
  }

  const awayTeam: Team = {
    id:        `api-team-${teams.away.id}`,
    name:      teams.away.name,
    shortName: teams.away.name.slice(0, 3).toUpperCase(),
    badge:     '🏟️',
    score:     goals.away ?? 0,
    players:   buildPlayers(awayLineup, duration),
    coach:     { id: coachId(awayLineup.coach.id), name: awayLineup.coach.name },
  }

  return {
    id:         row.internal_match_id,
    date,
    time,
    tournament: league.name,
    round:      formatRound(league.round),
    stadium:    fx.venue?.name ?? 'Estadio desconocido',
    status,
    home:       homeTeam,
    away:       awayTeam,
    referee:    { id: refId(fx.id), name: parseRefereeName(fx.referee) },
    rules:      defaultRules(),
    events:     buildEvents(afEvents, teams.home.id),
    ...(match_end_at ? { match_end_at } : {}),
    // periods: omitido — API-Football no provee endMinute por período.
    // processMatch funciona sin periods (usa 90/120 como matchEnd nominal).
  }
}
