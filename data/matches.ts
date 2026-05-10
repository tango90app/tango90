// Posiciones visibles en el producto (estilo FIFA/PES)
export type Position = 'ARQ' | 'LAD' | 'LAI' | 'DFC' | 'MC' | 'DEL' | 'CDEL'

// ── Período del partido ───────────────────────────────────────────────────
export type MatchPeriod = 'PT' | 'ST' | 'ET1' | 'ET2'

// ── Eventos del partido (union discriminado) ───────────────────────────────
// Eventos de JUEGO — requieren que el jugador esté en cancha en ese minuto
// Eventos DISCIPLINARIOS — pueden ocurrir independientemente de estar en cancha
//
// `minute`         → minuto absoluto: fuente de verdad lógica para ordenar y procesar.
// `period`         → período del partido (PT/ST/ET1/ET2): para display futbolero.
// `minuteInPeriod` → minuto dentro del período: para display futbolero.
// Si period+minuteInPeriod no coinciden con minute, processMatch genera un warning.
export type MatchEvent =
  | { type: 'goal';         playerId: string;                          minute: number; period?: MatchPeriod; minuteInPeriod?: number; team: 'home' | 'away' } // juego
  | { type: 'substitution'; playerOutId: string; playerInId: string;   minute: number; period?: MatchPeriod; minuteInPeriod?: number; team: 'home' | 'away'; concussionSub?: boolean } // juego
  | { type: 'yellow_card';  playerId: string;                          minute: number; period?: MatchPeriod; minuteInPeriod?: number; team: 'home' | 'away' } // disciplinario
  | { type: 'red_card';     playerId: string;                          minute: number; period?: MatchPeriod; minuteInPeriod?: number; team: 'home' | 'away' } // disciplinario

// ── Penales ────────────────────────────────────────────────────────────────
export type PenaltyKick = {
  playerId: string
  team: 'home' | 'away'
  scored: boolean
}

export type PenaltyShootout = {
  homeScore: number
  awayScore: number
  kicks?: PenaltyKick[]   // secuencia detallada — opcional
}

// ── Reglas del partido (configurable, no hardcodeado) ─────────────────────
export type MatchRules = {
  normalSubstitutionsLimit: number     // máximo de cambios en tiempo normal
  normalWindowsLimit: number           // máximo de ventanas de cambios
  extraTimeEnabled: boolean
  extraTimeAdditionalSubs: number      // cambios extra en prórroga
  extraTimeAdditionalWindow: number    // ventana extra en prórroga
  concussionSubsEnabled: boolean       // cambios por protocolo de conmoción
  concussionSubsUsedHome: number
  concussionSubsUsedAway: number
}

// ── Player — campo minutesPlayed se mantiene como legacy/manual ───────────
export type Player = {
  id: string
  name: string
  number: number
  position: Position
  minutesPlayed: number   // campo manual legacy — NO eliminar, convive con derivedMinutesPlayed
  starter: boolean        // true = titular de inicio, false = en el banco

  // API-Football lineup grid, ej: "2:3"
  grid?: string
}

export type Team = {
  id: string
  name: string
  shortName: string
  badge: string
  score: number
  players: Player[]
  coach: { id: string; name: string }
}

export type Match = {
  id: string
  date: string
  time: string
  tournament: string
  round: string
  stadium: string
  status: 'live' | 'finished' | 'upcoming' | 'suspended'
  home: Team
  away: Team
  referee: { id: string; name: string }
  rules: MatchRules
  events: MatchEvent[]
  periods?: MatchPeriods
  penaltyShootout?: PenaltyShootout  // solo si el partido se decidió por penales
  // ── Fases de votación ──────────────────────────────────────────────────
  // Timestamp ISO del fin real del partido.
  // Usado SOLO para calcular la fase de votación (blind / open / closed).
  // Formato: "YYYY-MM-DDTHH:mm:ss-03:00" (hora Argentina, UTC-3)
  //
  // TESTING — para simular cada fase, usá:
  //   voting_open_blind : new Date(Date.now() - 30 * 60 * 1000).toISOString()  // 30 min atrás
  //   voting_open       : new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()  // 3h atrás
  //   voting_closed     : new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h atrás
  match_end_at?: string
}

// ── Duración real del partido, período a período ──────────────────────────
// endMinute es el minuto absoluto real de cierre (ej: 47 si hubo 45+2, 98 si hubo 90+8).
// La conversión al display futbolero (45+2 / 90+8) queda para una etapa posterior.
export type MatchPeriods = {
  firstHalf:        { endMinute: number }
  secondHalf:       { endMinute: number }
  extraTimeFirst?:  { endMinute: number }
  extraTimeSecond?: { endMinute: number }
}

// ── Reglas estándar de la Liga Profesional Argentina ─────────────────────
export const DEFAULT_RULES: MatchRules = {
  normalSubstitutionsLimit: 5,
  normalWindowsLimit: 3,
  extraTimeEnabled: false,
  extraTimeAdditionalSubs: 1,
  extraTimeAdditionalWindow: 1,
  concussionSubsEnabled: false,
  concussionSubsUsedHome: 0,
  concussionSubsUsedAway: 0,
}

export const matches: Match[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // PARTIDO 5 — Argentina 3-3 Francia (AET) · Argentina 4-2 por penales
  // Final del Mundial Qatar 2022 · 2022-12-18
  //
  // Partido de prueba para validar:
  //   - prórroga (ET1 + ET2) y formato de minuto futbolero
  //   - múltiples goles del mismo jugador (Messi x2, Mbappé x3)
  //   - 7 sustituciones de Francia (5 + 1 ET + 1 conmoción)
  //   - minutos jugados con matchEnd = 124
  //   - penales separados del tiempo jugado
  //   - elegibilidad derivada de processMatch
  //
  // matchEnd = 124 (extraTimeSecond.endMinute)
  // Dybala y Disasi: sub_entered, 3 min < 5 → NO elegibles
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'argentina-francia-mundial-2022',
    date: '2022-12-18',
    time: '16:00',
    tournament: 'Mundial Qatar 2022',
    round: 'Final',
    stadium: 'Lusail Stadium',
    status: 'finished',
    match_end_at: '2026-05-01T12:00:00.000Z', // Qatar UTC+3, ~16:00 + 124' prórroga + tiempo extra
    rules: {
      normalSubstitutionsLimit: 5,
      normalWindowsLimit: 5,
      extraTimeEnabled: true,
      extraTimeAdditionalSubs: 1,
      extraTimeAdditionalWindow: 1,
      concussionSubsEnabled: true,
      concussionSubsUsedHome: 0,
      concussionSubsUsedAway: 1,
    },
    periods: {
      firstHalf:        { endMinute: 52  },
      secondHalf:       { endMinute: 98  },
      extraTimeFirst:   { endMinute: 106 },
      extraTimeSecond:  { endMinute: 124 },
    },
    penaltyShootout: {
      homeScore: 4,
      awayScore: 2,
      kicks: [
        { playerId: 'arg-mes', team: 'home', scored: true  },
        { playerId: 'fra-mba', team: 'away', scored: true  },
        { playerId: 'arg-dyb', team: 'home', scored: true  },
        { playerId: 'fra-com', team: 'away', scored: false },
        { playerId: 'arg-par', team: 'home', scored: true  },
        { playerId: 'fra-tch', team: 'away', scored: false },
        { playerId: 'arg-mon', team: 'home', scored: true  },
        { playerId: 'fra-kol', team: 'away', scored: true  },
      ],
    },
    home: {
      id: 'argentina',
      name: 'Argentina',
      shortName: 'ARG',
      badge: '🇦🇷',
      score: 3,
      coach: { id: 'arg-coach', name: 'Lionel Scaloni' },
      players: [
        { id: 'arg-mez', name: 'Emiliano Martínez',  number: 23, position: 'ARQ',  minutesPlayed: 124, starter: true  },
        { id: 'arg-mol', name: 'Nahuel Molina',       number: 26, position: 'LAD',  minutesPlayed: 91,  starter: true  },
        { id: 'arg-rom', name: 'Cristian Romero',     number: 13, position: 'DFC',  minutesPlayed: 124, starter: true  },
        { id: 'arg-ota', name: 'Nicolás Otamendi',    number: 19, position: 'DFC',  minutesPlayed: 124, starter: true  },
        { id: 'arg-tag', name: 'Nicolás Tagliafico',  number: 3,  position: 'LAI',  minutesPlayed: 121, starter: true  },
        { id: 'arg-dep', name: 'Rodrigo De Paul',     number: 7,  position: 'MC',   minutesPlayed: 102, starter: true  },
        { id: 'arg-enz', name: 'Enzo Fernández',      number: 24, position: 'MC',   minutesPlayed: 124, starter: true  },
        { id: 'arg-mac', name: 'Alexis Mac Allister', number: 20, position: 'MC',   minutesPlayed: 116, starter: true  },
        { id: 'arg-dim', name: 'Ángel Di María',      number: 11, position: 'DEL',  minutesPlayed: 64,  starter: true  },
        { id: 'arg-mes', name: 'Lionel Messi',        number: 10, position: 'DEL',  minutesPlayed: 124, starter: true  },
        { id: 'arg-alv', name: 'Julián Álvarez',      number: 9,  position: 'CDEL', minutesPlayed: 103, starter: true  },
        { id: 'arg-acu', name: 'Marcos Acuña',        number: 8,  position: 'LAI',  minutesPlayed: 60,  starter: false },
        { id: 'arg-mon', name: 'Gonzalo Montiel',     number: 4,  position: 'LAD',  minutesPlayed: 33,  starter: false },
        { id: 'arg-par', name: 'Leandro Paredes',     number: 5,  position: 'MC',   minutesPlayed: 22,  starter: false },
        { id: 'arg-lau', name: 'Lautaro Martínez',    number: 22, position: 'CDEL', minutesPlayed: 21,  starter: false },
        { id: 'arg-pez', name: 'Germán Pezzella',     number: 6,  position: 'DFC',  minutesPlayed: 8,   starter: false },
        { id: 'arg-dyb', name: 'Paulo Dybala',        number: 21, position: 'DEL',  minutesPlayed: 3,   starter: false },
      ],
    },
    away: {
      id: 'francia',
      name: 'Francia',
      shortName: 'FRA',
      badge: '🇫🇷',
      score: 3,
      coach: { id: 'fra-coach', name: 'Didier Deschamps' },
      players: [
        { id: 'fra-llo',  name: 'Hugo Lloris',           number: 1,  position: 'ARQ',  minutesPlayed: 124, starter: true  },
        { id: 'fra-kou',  name: 'Jules Koundé',           number: 5,  position: 'LAD',  minutesPlayed: 121, starter: true  },
        { id: 'fra-var',  name: 'Raphaël Varane',         number: 4,  position: 'DFC',  minutesPlayed: 113, starter: true  },
        { id: 'fra-upa',  name: 'Dayot Upamecano',        number: 15, position: 'DFC',  minutesPlayed: 124, starter: true  },
        { id: 'fra-theo', name: 'Theo Hernández',         number: 22, position: 'LAI',  minutesPlayed: 71,  starter: true  },
        { id: 'fra-tch',  name: 'Aurélien Tchouaméni',   number: 8,  position: 'MC',   minutesPlayed: 124, starter: true  },
        { id: 'fra-rab',  name: 'Adrien Rabiot',          number: 14, position: 'MC',   minutesPlayed: 96,  starter: true  },
        { id: 'fra-gri',  name: 'Antoine Griezmann',      number: 7,  position: 'MC',   minutesPlayed: 71,  starter: true  },
        { id: 'fra-dem',  name: 'Ousmane Dembélé',        number: 11, position: 'DEL',  minutesPlayed: 41,  starter: true  },
        { id: 'fra-gir',  name: 'Olivier Giroud',         number: 9,  position: 'CDEL', minutesPlayed: 41,  starter: true  },
        { id: 'fra-mba',  name: 'Kylian Mbappé',          number: 10, position: 'DEL',  minutesPlayed: 124, starter: true  },
        { id: 'fra-kol',  name: 'Randal Kolo Muani',      number: 20, position: 'CDEL', minutesPlayed: 83,  starter: false },
        { id: 'fra-thu',  name: 'Marcus Thuram',          number: 2,  position: 'DEL',  minutesPlayed: 83,  starter: false },
        { id: 'fra-com',  name: 'Kingsley Coman',         number: 12, position: 'DEL',  minutesPlayed: 53,  starter: false },
        { id: 'fra-cam',  name: 'Eduardo Camavinga',      number: 6,  position: 'MC',   minutesPlayed: 53,  starter: false },
        { id: 'fra-fof',  name: 'Youssouf Fofana',        number: 13, position: 'MC',   minutesPlayed: 28,  starter: false },
        { id: 'fra-kon',  name: 'Ibrahima Konaté',        number: 3,  position: 'DFC',  minutesPlayed: 11,  starter: false },
        { id: 'fra-dis',  name: 'Axel Disasi',            number: 17, position: 'DFC',  minutesPlayed: 3,   starter: false },
      ],
    },
    referee: { id: 'ref-wcf2022', name: 'Szymon Marciniak' },
    events: [
      { type: 'goal',         playerId: 'arg-mes',                            minute: 23,  period: 'PT',  minuteInPeriod: 23, team: 'home' },
      { type: 'goal',         playerId: 'arg-dim',                            minute: 36,  period: 'PT',  minuteInPeriod: 36, team: 'home' },
      { type: 'substitution', playerOutId: 'fra-dem', playerInId: 'fra-kol',  minute: 41,  period: 'PT',  minuteInPeriod: 41, team: 'away' },
      { type: 'substitution', playerOutId: 'fra-gir', playerInId: 'fra-thu',  minute: 41,  period: 'PT',  minuteInPeriod: 41, team: 'away' },
      { type: 'substitution', playerOutId: 'arg-dim', playerInId: 'arg-acu',  minute: 64,  period: 'ST',  minuteInPeriod: 19, team: 'home' },
      { type: 'substitution', playerOutId: 'fra-gri', playerInId: 'fra-com',  minute: 71,  period: 'ST',  minuteInPeriod: 26, team: 'away' },
      { type: 'substitution', playerOutId: 'fra-theo',playerInId: 'fra-cam',  minute: 71,  period: 'ST',  minuteInPeriod: 26, team: 'away' },
      { type: 'goal',         playerId: 'fra-mba',                            minute: 80,  period: 'ST',  minuteInPeriod: 35, team: 'away' },
      { type: 'goal',         playerId: 'fra-mba',                            minute: 81,  period: 'ST',  minuteInPeriod: 36, team: 'away' },
      { type: 'substitution', playerOutId: 'arg-mol', playerInId: 'arg-mon',  minute: 91,  period: 'ST',  minuteInPeriod: 46, team: 'home' },
      { type: 'substitution', playerOutId: 'fra-rab', playerInId: 'fra-fof',  minute: 96,  period: 'ET1', minuteInPeriod: 6,  team: 'away', concussionSub: true },
      { type: 'substitution', playerOutId: 'arg-dep', playerInId: 'arg-par',  minute: 102, period: 'ET1', minuteInPeriod: 12, team: 'home' },
      { type: 'substitution', playerOutId: 'arg-alv', playerInId: 'arg-lau',  minute: 103, period: 'ET1', minuteInPeriod: 13, team: 'home' },
      { type: 'goal',         playerId: 'arg-mes',                            minute: 108, period: 'ET1', minuteInPeriod: 18, team: 'home' },
      { type: 'substitution', playerOutId: 'fra-var', playerInId: 'fra-kon',  minute: 113, period: 'ET2', minuteInPeriod: 8,  team: 'away' },
      { type: 'substitution', playerOutId: 'arg-mac', playerInId: 'arg-pez',  minute: 116, period: 'ET2', minuteInPeriod: 11, team: 'home' },
      { type: 'goal',         playerId: 'fra-mba',                            minute: 118, period: 'ET2', minuteInPeriod: 13, team: 'away' },
      { type: 'substitution', playerOutId: 'arg-tag', playerInId: 'arg-dyb',  minute: 121, period: 'ET2', minuteInPeriod: 16, team: 'home' },
      { type: 'substitution', playerOutId: 'fra-kou', playerInId: 'fra-dis',  minute: 121, period: 'ET2', minuteInPeriod: 16, team: 'away' },
    ],
  },
]
