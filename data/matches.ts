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
  status: 'live' | 'finished' | 'upcoming'
  home: Team
  away: Team
  referee: { id: string; name: string }
  rules: MatchRules
  events: MatchEvent[]
  periods?: MatchPeriods
  penaltyShootout?: PenaltyShootout  // solo si el partido se decidió por penales
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
  // PARTIDO 1 — River Plate 2-1 Boca Juniors
  //
  // Correcciones aplicadas vs datos originales:
  //   [C1] b4 Rojo: minutesPlayed corregido de 90 → 78 (red_card a los 78')
  //   [C2] r14 Romero: jugador nuevo (r10 Gallardo Jr. salía al 80' sin par)
  //   [C3] b14 Langoni: jugador nuevo (b7 Medina salía al 73' sin par)
  //   [C4] 6 eventos substitution agregados (pares implícitos formalizados)
  //   [C5] Todos los eventos migrados de player:string a playerId:string
  //
  // Historia del partido:
  //   River: 3 cambios válidos (De La Cruz→Aliendro 65', Acuña→Solari 78', Gallardo Jr.→Romero 80')
  //   Boca:  3 cambios válidos + 1 expulsión no-cambio (Aguirre→Janson 60', Medina→Langoni 73', Cavani→Zeballos 82')
  //          Rojo expulsado 78' — no cuenta como cambio, no puede ser reemplazado
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'boca-river-2025-04',
    date: '2025-04-06',
    time: '17:00',
    tournament: 'Liga Profesional',
    round: 'Fecha 10',
    stadium: 'Estadio Monumental',
    status: 'finished',
    rules: { ...DEFAULT_RULES },
    home: {
      id: 'river',
      name: 'River Plate',
      shortName: 'RIV',
      badge: '🔴',
      score: 2,
      coach: { id: 'river-coach', name: 'Marcelo Gallardo' },
      players: [
        { id: 'r1',  name: 'Franco Armani',       number: 1,  position: 'ARQ',  minutesPlayed: 90, starter: true  },
        { id: 'r2',  name: 'Fabricio Bustos',      number: 2,  position: 'LAD',  minutesPlayed: 90, starter: true  },
        { id: 'r3',  name: 'Paulo Díaz',           number: 3,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'r4',  name: 'Germán Pezzella',      number: 4,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'r5',  name: 'Marcos Acuña',         number: 5,  position: 'LAI',  minutesPlayed: 78, starter: true  },
        { id: 'r6',  name: 'Enzo Pérez',           number: 6,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'r7',  name: 'Nicolás De La Cruz',   number: 7,  position: 'MC',   minutesPlayed: 65, starter: true  },
        { id: 'r8',  name: 'Manuel Lanzini',       number: 8,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'r9',  name: 'Gonzalo Montiel',      number: 9,  position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'r10', name: 'Marcelo Gallardo Jr.', number: 10, position: 'DEL',  minutesPlayed: 80, starter: true  },
        { id: 'r11', name: 'Facundo Colidio',      number: 11, position: 'CDEL', minutesPlayed: 90, starter: true  },
        { id: 'r12', name: 'Rodrigo Aliendro',     number: 12, position: 'MC',   minutesPlayed: 25, starter: false }, // ingresó 65' por r7
        { id: 'r13', name: 'Pablo Solari',         number: 13, position: 'DEL',  minutesPlayed: 12, starter: false }, // ingresó 78' por r5
        { id: 'r14', name: 'Braian Romero',        number: 14, position: 'CDEL', minutesPlayed: 10, starter: false }, // [C2] ingresó 80' por r10
      ],
    },
    away: {
      id: 'boca',
      name: 'Boca Juniors',
      shortName: 'BOC',
      badge: '🔵',
      score: 1,
      coach: { id: 'boca-coach', name: 'Diego Martínez' },
      players: [
        { id: 'b1',  name: 'Sergio Romero',          number: 1,  position: 'ARQ',  minutesPlayed: 90, starter: true  },
        { id: 'b2',  name: 'Luis Advíncula',          number: 2,  position: 'LAD',  minutesPlayed: 90, starter: true  },
        { id: 'b3',  name: 'Cristian Lema',           number: 3,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'b4',  name: 'Marcos Rojo',             number: 4,  position: 'DFC',  minutesPlayed: 78, starter: true  }, // [C1] era 90, corregido a 78 (red_card 78')
        { id: 'b5',  name: 'Frank Fabra',             number: 5,  position: 'LAI',  minutesPlayed: 90, starter: true  },
        { id: 'b6',  name: 'Guillermo Pol Fernández', number: 6,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'b7',  name: 'Cristian Medina',         number: 7,  position: 'MC',   minutesPlayed: 73, starter: true  },
        { id: 'b8',  name: 'Kevin Zenón',             number: 8,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'b9',  name: 'Miguel Merentiel',        number: 9,  position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'b10', name: 'Cavani',                  number: 10, position: 'CDEL', minutesPlayed: 82, starter: true  },
        { id: 'b11', name: 'Brian Aguirre',           number: 11, position: 'DEL',  minutesPlayed: 60, starter: true  },
        { id: 'b12', name: 'Lucas Janson',            number: 12, position: 'DEL',  minutesPlayed: 30, starter: false }, // ingresó 60' por b11
        { id: 'b13', name: 'Exequiel Zeballos',       number: 13, position: 'DEL',  minutesPlayed: 8,  starter: false }, // ingresó 82' por b10
        { id: 'b14', name: 'Luca Langoni',            number: 14, position: 'MC',   minutesPlayed: 17, starter: false }, // [C3] ingresó 73' por b7
      ],
    },
    referee: { id: 'ref-1', name: 'Darío Herrera' },
    events: [
      // ── Primer tiempo (PT) ──────────────────────────────────────────────
      { type: 'goal',         playerId: 'r11',                         minute: 23, period: 'PT', minuteInPeriod: 23, team: 'home' }, // Colidio
      // ── Segundo tiempo (ST) — ST min = absolute - 45 ───────────────────
      { type: 'goal',         playerId: 'b10',                         minute: 55, period: 'ST', minuteInPeriod: 10, team: 'away' }, // Cavani
      { type: 'substitution', playerOutId: 'b11', playerInId: 'b12',   minute: 60, period: 'ST', minuteInPeriod: 15, team: 'away' }, // Aguirre → Janson
      { type: 'substitution', playerOutId: 'r7',  playerInId: 'r12',   minute: 65, period: 'ST', minuteInPeriod: 20, team: 'home' }, // De La Cruz → Aliendro
      { type: 'goal',         playerId: 'r8',                          minute: 67, period: 'ST', minuteInPeriod: 22, team: 'home' }, // Lanzini
      { type: 'substitution', playerOutId: 'b7',  playerInId: 'b14',   minute: 73, period: 'ST', minuteInPeriod: 28, team: 'away' }, // Medina → Langoni
      { type: 'substitution', playerOutId: 'r5',  playerInId: 'r13',   minute: 78, period: 'ST', minuteInPeriod: 33, team: 'home' }, // Acuña → Solari
      { type: 'red_card',     playerId: 'b4',                          minute: 78, period: 'ST', minuteInPeriod: 33, team: 'away' }, // Rojo expulsado
      { type: 'substitution', playerOutId: 'r10', playerInId: 'r14',   minute: 80, period: 'ST', minuteInPeriod: 35, team: 'home' }, // Gallardo Jr. → Romero
      { type: 'substitution', playerOutId: 'b10', playerInId: 'b13',   minute: 82, period: 'ST', minuteInPeriod: 37, team: 'away' }, // Cavani → Zeballos
    ],
periods: {
  firstHalf: { endMinute: 47 },
  secondHalf: { endMinute: 98 },
},
},

  // ═══════════════════════════════════════════════════════════════════════
  // PARTIDO 2 — Racing Club 3-1 Independiente
  //
  // Correcciones aplicadas vs datos originales:
  //   [C1] rc12 Copetti: jugador nuevo (rc8 Zaracho salía al 68' sin par)
  //   [C2] rc13 Togni: jugador nuevo (rc5 Mena salía al 80' sin par)
  //   [C3] i12 Batallini: jugador nuevo (i10 Indacoechea salía al 60' sin par)
  //   [C4] i13 Toloza: jugador nuevo (i6 Marcone salía al 72' sin par)
  //   [C5] 4 eventos substitution agregados
  //   [C6] Todos los eventos migrados de player:string a playerId:string
  //
  // Historia del partido:
  //   Racing:        2 cambios válidos (Zaracho→Copetti 68', Mena→Togni 80')
  //   Independiente: 2 cambios válidos (Indacoechea→Batallini 60', Marcone→Toloza 72')
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'racing-independiente-2025-04',
    date: '2025-04-06',
    time: '19:30',
    tournament: 'Liga Profesional',
    round: 'Fecha 10',
    stadium: 'Estadio Presidente Perón',
    status: 'finished',
    rules: { ...DEFAULT_RULES },
    home: {
      id: 'racing',
      name: 'Racing Club',
      shortName: 'RAC',
      badge: '🔵',
      score: 3,
      coach: { id: 'racing-coach', name: 'Gustavo Costas' },
      players: [
        { id: 'rc1',  name: 'Gabriel Arias',     number: 1,  position: 'ARQ',  minutesPlayed: 90, starter: true  },
        { id: 'rc2',  name: 'Gastón Martirena',  number: 2,  position: 'LAD',  minutesPlayed: 90, starter: true  },
        { id: 'rc3',  name: 'Marco Di Césare',   number: 3,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'rc4',  name: 'Emiliano Insúa',    number: 4,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'rc5',  name: 'Eugenio Mena',      number: 5,  position: 'LAI',  minutesPlayed: 80, starter: true  },
        { id: 'rc6',  name: 'Aníbal Moreno',     number: 6,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'rc7',  name: 'Agustín Almendra',  number: 7,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'rc8',  name: 'Matías Zaracho',    number: 8,  position: 'MC',   minutesPlayed: 68, starter: true  },
        { id: 'rc9',  name: 'Carlos Alcaraz',    number: 9,  position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'rc10', name: 'Adrián Martínez',   number: 10, position: 'CDEL', minutesPlayed: 90, starter: true  },
        { id: 'rc11', name: 'Maximiliano Salas', number: 11, position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'rc12', name: 'Enzo Copetti',      number: 18, position: 'CDEL', minutesPlayed: 22, starter: false }, // [C1] ingresó 68' por rc8
        { id: 'rc13', name: 'Gastón Togni',      number: 20, position: 'LAI',  minutesPlayed: 10, starter: false }, // [C2] ingresó 80' por rc5
      ],
    },
    away: {
      id: 'independiente',
      name: 'Independiente',
      shortName: 'IND',
      badge: '🔴',
      score: 1,
      coach: { id: 'ind-coach', name: 'Eduardo Domínguez' },
      players: [
        { id: 'i1',  name: 'Rodrigo Rey',        number: 1,  position: 'ARQ',  minutesPlayed: 90, starter: true  },
        { id: 'i2',  name: 'Lucas Romero',        number: 2,  position: 'LAD',  minutesPlayed: 90, starter: true  },
        { id: 'i3',  name: 'Sergio Barreto',      number: 3,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'i4',  name: 'Alexander Barboza',   number: 4,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'i5',  name: 'Fabricio Bustos',     number: 5,  position: 'LAI',  minutesPlayed: 90, starter: true  },
        { id: 'i6',  name: 'Iván Marcone',        number: 6,  position: 'MC',   minutesPlayed: 72, starter: true  },
        { id: 'i7',  name: 'Lucas González',      number: 7,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'i8',  name: 'Rodrigo Márquez',     number: 8,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'i9',  name: 'Silvio Romero',       number: 9,  position: 'CDEL', minutesPlayed: 90, starter: true  },
        { id: 'i10', name: 'Joaquín Indacoechea', number: 10, position: 'DEL',  minutesPlayed: 60, starter: true  },
        { id: 'i11', name: 'Alan Velasco',        number: 11, position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'i12', name: 'Damián Batallini',    number: 17, position: 'DEL',  minutesPlayed: 30, starter: false }, // [C3] ingresó 60' por i10
        { id: 'i13', name: 'Santiago Toloza',     number: 22, position: 'MC',   minutesPlayed: 18, starter: false }, // [C4] ingresó 72' por i6
      ],
    },
    referee: { id: 'ref-2', name: 'Pablo Echavarría' },
    events: [
      // ── Primer tiempo (PT) ──────────────────────────────────────────────
      { type: 'goal',         playerId: 'rc9',                         minute: 12, period: 'PT', minuteInPeriod: 12, team: 'home' }, // Alcaraz
      { type: 'goal',         playerId: 'i9',                          minute: 38, period: 'PT', minuteInPeriod: 38, team: 'away' }, // S. Romero
      { type: 'goal',         playerId: 'rc10',                        minute: 44, period: 'PT', minuteInPeriod: 44, team: 'home' }, // Martínez
      // ── Segundo tiempo (ST) ─────────────────────────────────────────────
      { type: 'substitution', playerOutId: 'i10', playerInId: 'i12',   minute: 60, period: 'ST', minuteInPeriod: 15, team: 'away' }, // Indacoechea → Batallini
      { type: 'substitution', playerOutId: 'rc8', playerInId: 'rc12',  minute: 68, period: 'ST', minuteInPeriod: 23, team: 'home' }, // Zaracho → Copetti
      { type: 'substitution', playerOutId: 'i6',  playerInId: 'i13',   minute: 72, period: 'ST', minuteInPeriod: 27, team: 'away' }, // Marcone → Toloza
      { type: 'substitution', playerOutId: 'rc5', playerInId: 'rc13',  minute: 80, period: 'ST', minuteInPeriod: 35, team: 'home' }, // Mena → Togni
      { type: 'goal',         playerId: 'rc11',                        minute: 81, period: 'ST', minuteInPeriod: 36, team: 'home' }, // Salas
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PARTIDO 3 — San Lorenzo 0-2 Huracán
  //
  // Correcciones aplicadas vs datos originales:
  //   [C1] sl9 Dátolo: minutesPlayed corregido de 55 → 58 (red_card a los 58', dato manual era error)
  //   [C2] sl12 Gil: jugador nuevo (sl7 Vombergar salía al 75' sin par; SL tenía 10 hombres pero el cupo es independiente)
  //   [C3] h12 Cordero: jugador nuevo (h8 Insúa salía al 70' sin par)
  //   [C4] h13 Almirón: jugador nuevo (h5 Cóccaro salía al 88' sin par)
  //   [C5] 3 eventos substitution agregados
  //   [C6] Todos los eventos migrados de player:string a playerId:string
  //
  // Historia del partido:
  //   San Lorenzo: 1 cambio válido (Vombergar→Gil 75'). Dátolo expulsado 58' — no cuenta.
  //   Huracán:     2 cambios válidos (Insúa→Cordero 70', Cóccaro→Almirón 88')
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'san-lorenzo-huracan-2025-04',
    date: '2025-04-05',
    time: '21:00',
    tournament: 'Liga Profesional',
    round: 'Fecha 10',
    stadium: 'Estadio Pedro Bidegaín',
    status: 'finished',
    rules: { ...DEFAULT_RULES },
    home: {
      id: 'san-lorenzo',
      name: 'San Lorenzo',
      shortName: 'SLO',
      badge: '🔴',
      score: 0,
      coach: { id: 'sl-coach', name: 'Leandro Romagnoli' },
      players: [
        { id: 'sl1',  name: 'Augusto Batalla', number: 1,  position: 'ARQ',  minutesPlayed: 90, starter: true  },
        { id: 'sl2',  name: 'Nahuel Genez',    number: 2,  position: 'LAD',  minutesPlayed: 90, starter: true  },
        { id: 'sl3',  name: 'Federico Gattoni',number: 3,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'sl4',  name: 'Gastón Campi',    number: 4,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'sl5',  name: 'Alexis Cuello',   number: 5,  position: 'LAI',  minutesPlayed: 90, starter: true  },
        { id: 'sl6',  name: 'Iker Muniain',    number: 6,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'sl7',  name: 'Andrés Vombergar',number: 7,  position: 'MC',   minutesPlayed: 75, starter: true  },
        { id: 'sl8',  name: 'Ezequiel Cerutti',number: 8,  position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'sl9',  name: 'Jesús Dátolo',    number: 9,  position: 'MC',   minutesPlayed: 58, starter: true  }, // [C1] era 55, corregido a 58 (red_card 58')
        { id: 'sl10', name: 'Elián Irala',     number: 10, position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'sl11', name: 'Adam Bareiro',    number: 11, position: 'CDEL', minutesPlayed: 90, starter: true  },
        { id: 'sl12', name: 'Gastón Gil',      number: 16, position: 'MC',   minutesPlayed: 15, starter: false }, // [C2] ingresó 75' por sl7
      ],
    },
    away: {
      id: 'huracan',
      name: 'Huracán',
      shortName: 'HUR',
      badge: '🟠',
      score: 2,
      coach: { id: 'hur-coach', name: 'Frank Darío Kudelka' },
      players: [
        { id: 'h1',  name: 'Antony Silva',      number: 1,  position: 'ARQ',  minutesPlayed: 90, starter: true  },
        { id: 'h2',  name: 'Guillermo Costilla', number: 2,  position: 'LAD',  minutesPlayed: 90, starter: true  },
        { id: 'h3',  name: 'Emiliano Amor',      number: 3,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'h4',  name: 'Leonel Mosevich',    number: 4,  position: 'DFC',  minutesPlayed: 90, starter: true  },
        { id: 'h5',  name: 'Matías Cóccaro',     number: 5,  position: 'LAI',  minutesPlayed: 88, starter: true  },
        { id: 'h6',  name: 'Rodrigo Cabral',     number: 6,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'h7',  name: 'Ezequiel Ham',       number: 7,  position: 'MC',   minutesPlayed: 90, starter: true  },
        { id: 'h8',  name: 'Rodrigo Insúa',      number: 8,  position: 'MC',   minutesPlayed: 70, starter: true  },
        { id: 'h9',  name: 'Walter Mazzantti',   number: 9,  position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'h10', name: 'Ignacio Pussetto',   number: 10, position: 'DEL',  minutesPlayed: 90, starter: true  },
        { id: 'h11', name: 'Santiago Hezze',     number: 11, position: 'CDEL', minutesPlayed: 90, starter: true  },
        { id: 'h12', name: 'Nicolás Cordero',    number: 19, position: 'MC',   minutesPlayed: 20, starter: false }, // [C3] ingresó 70' por h8
        { id: 'h13', name: 'Franco Almirón',     number: 23, position: 'LAI',  minutesPlayed: 2,  starter: false }, // [C4] ingresó 88' por h5
      ],
    },
    referee: { id: 'ref-3', name: 'Leandro Rey Hilfer' },
    events: [
      // ── Primer tiempo (PT) ──────────────────────────────────────────────
      { type: 'goal',         playerId: 'h11',                          minute: 34, period: 'PT', minuteInPeriod: 34, team: 'away' }, // Hezze
      // ── Segundo tiempo (ST) ─────────────────────────────────────────────
      { type: 'red_card',     playerId: 'sl9',                          minute: 58, period: 'ST', minuteInPeriod: 13, team: 'home' }, // Dátolo expulsado
      { type: 'substitution', playerOutId: 'h8',  playerInId: 'h12',    minute: 70, period: 'ST', minuteInPeriod: 25, team: 'away' }, // Insúa → Cordero
      { type: 'goal',         playerId: 'h10',                          minute: 71, period: 'ST', minuteInPeriod: 26, team: 'away' }, // Pussetto
      { type: 'substitution', playerOutId: 'sl7', playerInId: 'sl12',   minute: 75, period: 'ST', minuteInPeriod: 30, team: 'home' }, // Vombergar → Gil
      { type: 'substitution', playerOutId: 'h5',  playerInId: 'h13',    minute: 88, period: 'ST', minuteInPeriod: 43, team: 'away' }, // Cóccaro → Almirón
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PARTIDO 4 — Estudiantes LP vs Gimnasia LP (próximo, sin datos)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'estudiantes-gimnasia-2025-04',
    date: '2025-04-07',
    time: '18:00',
    tournament: 'Liga Profesional',
    round: 'Fecha 10',
    stadium: 'Estadio Jorge Luis Hirschi',
    status: 'upcoming',
    rules: { ...DEFAULT_RULES },
    home: {
      id: 'estudiantes',
      name: 'Estudiantes LP',
      shortName: 'EST',
      badge: '🔴',
      score: 0,
      coach: { id: 'est-coach', name: 'Eduardo Domínguez' },
      players: [],
    },
    away: {
      id: 'gimnasia',
      name: 'Gimnasia LP',
      shortName: 'GIM',
      badge: '🔵',
      score: 0,
      coach: { id: 'gim-coach', name: 'Mariano Soso' },
      players: [],
    },
    referee: { id: 'ref-4', name: 'Fernando Espinoza' },
    events: [],
  },

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
