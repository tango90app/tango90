import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { matches, type Match } from '@/data/matches'
import { supabaseServer } from '@/lib/supabaseServer'
import { processMatch, getVotableEntityIds } from '@/lib/processMatch'
import MatchStatusBadge from '@/components/MatchStatusBadge'
import { getTeamByApiFootballId, getTeamByKey } from '@/data/teams'
import AdSlot from '@/components/AdSlot'

const PJS = "'Plus Jakarta Sans', sans-serif"
const OBJ = "'Plus Jakarta Sans', sans-serif"

export const dynamic = 'force-dynamic'
export const revalidate = 0

function LiveBadge() {
  return (
    <span style={{
      fontFamily: 'Oswald, sans-serif',
      fontSize: 10,
      fontWeight: 700,
      borderRadius: 3,
      letterSpacing: '0.07em',

      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 64,
      height: 22,

      background: '#FF1200',
      color: '#FFFFFF',
    }}>
      ● EN VIVO
    </span>
  )
}

function UpcomingBadge() {
  return (
    <span style={{ background: '#1A1A22', color: '#6B7280', fontFamily: PJS, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em' }}>
      PRÓXIMO
    </span>
  )
}

function SuspendedBadge() {
  return (
    <span style={{
      fontFamily: 'Oswald, sans-serif',
      fontSize: 10,
      fontWeight: 700,
      borderRadius: 3,
      letterSpacing: '0.07em',

      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 64,
      height: 22,

      background: 'rgba(239,68,68,0.12)',
      color: '#EF4444',
    }}>
      SUSPENDIDO
    </span>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
}

function getArgentinaDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDaysToDate(dateStr: string, amount: number) {
  const date = new Date(`${dateStr}T12:00:00`)
  date.setDate(date.getDate() + amount)

  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function formatFullDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`)

  return date
    .toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    .toUpperCase()
}

function getDateTitle(selectedDate: string, todayDate: string) {
  if (selectedDate === todayDate) return 'HOY'
  if (selectedDate === addDaysToDate(todayDate, -1)) return 'AYER'
  if (selectedDate === addDaysToDate(todayDate, 1)) return 'MAÑANA'

  return formatFullDate(selectedDate)
}

const COMPETITIONS = [
  {
    key: 'lpf',
    label: 'LPF',
    title: 'LIGA PROFESIONAL DE FÚTBOL',
    logos: ['/logos/competitions/afa.svg', '/logos/competitions/lpf.svg'],
  },
  {
    key: 'libertadores',
    label: 'COPA LIBERTADORES',
    title: 'CONMEBOL LIBERTADORES',
    logos: [],
  },
  {
    key: 'sudamericana',
    label: 'COPA SUDAMERICANA',
    title: 'COPA CONMEBOL SUDAMERICANA',
    logos: ['/logos/competitions/sudamericana.svg'],
  },
  {
    key: 'mundial',
    label: 'MUNDIAL 2026',
    title: 'Copa Mundial de la FIFA 2026',
    logos: ['/logos/competitions/fwc2026.svg'],
  },
] as const

type CompetitionKey = typeof COMPETITIONS[number]['key']

function getCompetitionKey(match: Match): CompetitionKey {
  const text = `${match.tournament ?? ''} ${match.round ?? ''}`.toLowerCase()

  if (text.includes('libertadores')) return 'libertadores'
  if (text.includes('sudamericana')) return 'sudamericana'
  if (text.includes('world cup') || text.includes('mundial')) return 'mundial'

  return 'lpf'
}

function formatVoteCount(count: number) {
  if (count < 10) return null
  if (count < 25) return '+10 votos'
  if (count < 50) return '+25 votos'
  if (count < 100) return '+50 votos'
  if (count < 200) return '+100 votos'
  if (count < 500) return '+250 votos'
  if (count < 1000) return '+500 votos'
  if (count < 2500) return '+1k votos'
  if (count < 5000) return '+2.5k votos'
  if (count < 10000) return '+5k votos'
  return '+10k votos'
}

function normalizeRound(round?: string, competitionKey?: CompetitionKey) {
  if (!round) return ''

  const r = round.toLowerCase()

  // ── LIBERTADORES ─────────────────────────────────────────────
  if (competitionKey === 'libertadores') {
    const groupStageMatch =
      r.match(/group stage\s*-\s*(\d+)/) ||
      r.match(/fecha\s*(\d+)/)

    if (groupStageMatch) {
      return `FASE DE GRUPOS · FECHA ${groupStageMatch[1]}`
    }

    if (r.includes('round of 16')) {
      if (r.includes('2nd')) return '8vos de FINAL · VUELTA'
      return '8vos de FINAL · IDA'
    }

    if (r.includes('quarter')) {
      if (r.includes('2nd')) return '4tos de FINAL · VUELTA'
      return '4tos de FINAL · IDA'
    }

    if (r.includes('semi')) {
      if (r.includes('2nd')) return 'SEMIFINAL · VUELTA'
      return 'SEMIFINAL · IDA'
    }

    if (r === 'final') {
      return 'FINAL'
    }
  }

    // ── SUDAMERICANA ──────────────────────────────────────────────
if (competitionKey === 'sudamericana') {
  if (r.includes('round of 32')) return 'PLAY-OFF'
  if (r.includes('round of 16')) return '8vos de FINAL'
  if (r.includes('quarter')) return '4tos de FINAL'
  if (r.includes('semi')) return 'SEMIFINAL'
  if (r === 'final') return 'FINAL'
}

  // ── LPF ──────────────────────────────────────────────────────
  if (competitionKey === 'lpf') {
    const clausuraFechaMatch =
      r.match(/clausura\s*-\s*(?:fecha\s*)?(\d+)/)

    if (clausuraFechaMatch) {
      return `CLAUSURA · FECHA ${clausuraFechaMatch[1]}`
    }

    const aperturaFechaMatch =
      r.match(/apertura\s*-\s*(?:fecha\s*)?(\d+)/)

    if (aperturaFechaMatch) {
      return `APERTURA · FECHA ${aperturaFechaMatch[1]}`
    }

    const fechaMatch = r.match(/fecha\s*(\d+)/)

    if (fechaMatch) {
      return `APERTURA · FECHA ${fechaMatch[1]}`
    }

    const tournamentName =
      r.includes('clausura')
        ? 'CLAUSURA'
        : 'APERTURA'

    if (r.includes('round of 16')) {
      return `${tournamentName} · 8vos de FINAL`
    }

    if (r.includes('quarter')) {
      return `${tournamentName} · 4tos de FINAL`
    }

    if (r.includes('semi')) {
      return `${tournamentName} · SEMIFINAL`
    }

    if (r.includes('final')) {
      return `${tournamentName} · FINAL`
    }
  }

  // ── MUNDIAL ─────────────────────────────────────────────

if (competitionKey === 'mundial') {

  const groupStageMatch =
    r.match(/group stage\s*-\s*(\d+)/)

  if (groupStageMatch) {
    return `FASE DE GRUPOS · FECHA ${groupStageMatch[1]}`
  }

  const fechaMatch =
    r.match(/fecha\s*(\d+)/)

  if (fechaMatch) {
    return `FASE DE GRUPOS · FECHA ${fechaMatch[1]}`
  }

  if (r.includes('round of 32')) return '16vos DE FINAL'
  if (r.includes('round of 16')) return '8vos DE FINAL'
  if (r.includes('quarter')) return '4tos DE FINAL'
  if (r.includes('semi')) return 'SEMIFINAL'
  if (r.includes('3rd')) return '3er PUESTO'
  if (r === 'final') return 'FINAL'
}

  return round.toUpperCase()
}

function formatRoundLabel(
  round?: string,
  _competitionKey?: CompetitionKey
) {
  return round ?? ''
}

function getDailyRoundLabel(
  matches: Match[],
  competitionKey: CompetitionKey
) {
  const rounds = Array.from(
    new Set(
      matches
        .map(match => normalizeRound(match.round, competitionKey))
        .filter(Boolean)
    )
  )

  return rounds.join(' / ')
}

function getMatchTimeLabel(match: Match) {
  if (match.status === 'upcoming') {
    return match.time
  }

  if (match.status === 'live') {
    return 'VIVO'
  }

  if (match.status === 'finished') {
    if (!match.match_end_at) return 'FIN'

    const end = new Date(match.match_end_at).getTime()
    const now = Date.now()

    const diffMs = end + (24 * 60 * 60 * 1000) - now
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
const diffHours = Math.floor(diffMinutes / 60)

if (diffMinutes <= 0) return 'FIN'
if (diffMinutes < 60) return `${diffMinutes}M`

return `${diffHours}H`
  }

  return ''
}

function getCountdownColor(match: Match) {
  if (match.status !== 'finished' || !match.match_end_at) return '#6B7280'

  const end = new Date(match.match_end_at).getTime()
  const now = Date.now()
  const diffMs = end + (24 * 60 * 60 * 1000) - now
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours <= 0) return '#6B7280'
  if (diffHours <= 0.5) return '#FFFFFF'
  if (diffHours <= 2) return '#F2F2F2'
  if (diffHours <= 6) return '#9CA3AF'
  return '#6B7280'
}

function sortDailyMatches(a: Match, b: Match) {
  const getStatusPriority = (match: Match) => {
    if (match.status === 'live') return 1
    if (match.status === 'upcoming') return 2
    if (match.status === 'finished') return 3
    if (match.status === 'suspended') return 4
    return 5
  }

  const priorityDifference =
    getStatusPriority(a) - getStatusPriority(b)

  if (priorityDifference !== 0) {
    return priorityDifference
  }

  if (a.status === 'finished' && b.status === 'finished') {
    const aEnd = a.match_end_at
      ? new Date(a.match_end_at).getTime()
      : 0

    const bEnd = b.match_end_at
      ? new Date(b.match_end_at).getTime()
      : 0

    return bEnd - aEnd
  }

  return a.time.localeCompare(b.time)
}

type HomeProps = {
  searchParams?: {
    competition?: string
    round?: string
    date?: string
  }
}

function mapTrackedFixtureStatus(status: string) {
  switch (status) {
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'INT':
      return 'live'

    case 'SUSP':
    case 'suspended':
      return 'suspended'

    default:
      return 'upcoming'
  }
}

export default async function Home({ searchParams }: HomeProps) {
  noStore()

  const { data: apiRows, error } = await supabaseServer
    .from('matches_api')
    .select('data')
    .order('updated_at', { ascending: false })

  const normalizeTeam = (team: any) => {
  const apiId = Number(String(team.id).replace('api-team-', ''))

  const mapped = Number.isFinite(apiId)
    ? getTeamByApiFootballId(apiId) ?? getTeamByKey(team.id)
    : getTeamByKey(team.id)

  return {
    ...team,
    id: mapped?.teamKey ?? team.id,
    name: mapped?.displayName ?? team.name,
    shortName: mapped?.abbreviation ?? team.shortName,
    badge: mapped?.crestPath ?? team.badge,
  }
}
    const apiMatches: Match[] = error
  ? []
  : (apiRows ?? [])
      .map(row => row.data as Match)
      .filter(m => m && m.id && m.date)
      .map(m => ({
        ...m,
        home: normalizeTeam(m.home),
away: normalizeTeam(m.away),
      }))

  const { data: trackedRows } = await supabaseServer
    .from('tracked_fixtures')
    .select('*')
    .order('kickoff_at', { ascending: true })

    const trackedRoundByMatchId: Record<string, string> = {}

    for (const row of trackedRows ?? []) {
      if (row.internal_match_id && row.round) {
        trackedRoundByMatchId[row.internal_match_id] = row.round
      }
    }

    const apiMatchIds = new Set(apiMatches.map(m => m.id))

    const trackedMatches: Match[] = (trackedRows ?? [])
      .filter(
        (row: any) =>
          row.published === false &&
          !apiMatchIds.has(row.internal_match_id)
      )
      .map((row: any) => ({
        id: row.internal_match_id,
        date: new Date(row.kickoff_at).toLocaleDateString('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires'
    }),
    time: new Date(row.kickoff_at).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    }),
    tournament: row.league_name ?? 'Liga Profesional Argentina',
    round: row.round ?? 'Próximo',
    stadium: '',
    status: mapTrackedFixtureStatus(row.status),
    minute: row.minute ?? null,
    apiStatus: row.api_status ?? null,
    home: {
  id: getTeamByApiFootballId(row.home_team_id)?.teamKey ?? `api-team-${row.home_team_id}`,
  name: getTeamByApiFootballId(row.home_team_id)?.displayName ?? row.home_name,
  shortName: getTeamByApiFootballId(row.home_team_id)?.abbreviation ?? row.home_name.slice(0, 3).toUpperCase(),
  badge: getTeamByApiFootballId(row.home_team_id)?.crestPath ?? '🏟️',
  score: row.home_score ?? 0,
  players: [],
  coach: { id: `api-coach-${row.home_team_id}`, name: '' },
},
away: {
  id: getTeamByApiFootballId(row.away_team_id)?.teamKey ?? `api-team-${row.away_team_id}`,
  name: getTeamByApiFootballId(row.away_team_id)?.displayName ?? row.away_name,
  shortName: getTeamByApiFootballId(row.away_team_id)?.abbreviation ?? row.away_name.slice(0, 3).toUpperCase(),
  badge: getTeamByApiFootballId(row.away_team_id)?.crestPath ?? '🏟️',
  score: row.away_score ?? 0,
  players: [],
  coach: { id: `api-coach-${row.away_team_id}`, name: '' },
},
    referee: { id: `api-ref-${row.external_fixture_id}`, name: '' },
    rules: {
      normalSubstitutionsLimit: 5,
      normalWindowsLimit: 3,
      extraTimeEnabled: false,
      extraTimeAdditionalSubs: 1,
      extraTimeAdditionalWindow: 1,
      concussionSubsEnabled: false,
      concussionSubsUsedHome: 0,
      concussionSubsUsedAway: 0,
    },
    events: [],
  }))

  const correctedApiMatches: Match[] = apiMatches.map(match => ({
    ...match,
    round: trackedRoundByMatchId[match.id] ?? match.round,
  }))

const allMatches: Match[] = [...trackedMatches, ...correctedApiMatches]

  const todayDate = getArgentinaDateString()

const requestedDate =
  typeof searchParams?.date === 'string'
    ? searchParams.date
    : null

const selectedDate =
  requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : todayDate

const previousDate = addDaysToDate(selectedDate, -1)
const nextDate = addDaysToDate(selectedDate, 1)

  const matchIds = allMatches.map(m => m.id)

const { data: voteRows } = await supabaseServer
  .from('votes')
  .select('match_id')
  .in('match_id', matchIds)

const voteCountsByMatchId: Record<string, number> = {}

for (const row of voteRows ?? []) {
  const matchId = row.match_id as string
  voteCountsByMatchId[matchId] = (voteCountsByMatchId[matchId] ?? 0) + 1
}

  const visibleCompetitions = COMPETITIONS.filter(competition =>
  competition.key !== 'libertadores' &&
  allMatches.some(match => getCompetitionKey(match) === competition.key)
)

const requestedCompetitionKey =
  typeof searchParams?.competition === 'string'
    ? (searchParams.competition as CompetitionKey)
    : null

const validRequestedCompetitionKey =
  requestedCompetitionKey &&
  visibleCompetitions.some(competition => competition.key === requestedCompetitionKey)
    ? requestedCompetitionKey
    : null

const isDailyView = validRequestedCompetitionKey === null

const activeCompetitionKey: CompetitionKey =
  validRequestedCompetitionKey ??
  visibleCompetitions[0]?.key ??
  'lpf'

const activeCompetition =
  visibleCompetitions.find(c => c.key === activeCompetitionKey) ??
  visibleCompetitions[0] ??
  COMPETITIONS[0]

const filteredMatches = allMatches.filter(match =>
  getCompetitionKey(match) === activeCompetitionKey
)

const dailyMatches = allMatches.filter(match =>
  match.date === selectedDate
)

const dailyCompetitions = COMPETITIONS.filter(competition =>
  dailyMatches.some(match =>
    getCompetitionKey(match) === competition.key
  )
)

const dailySections = dailyCompetitions.map(competition => ({
  competition,
  matches: dailyMatches
    .filter(match =>
      getCompetitionKey(match) === competition.key
    )
    .sort(sortDailyMatches),
}))

const roundOrder =
  activeCompetitionKey === 'lpf'
  ? [
      'APERTURA · FECHA 1',
      'APERTURA · FECHA 2',
      'APERTURA · FECHA 3',
      'APERTURA · FECHA 4',
      'APERTURA · FECHA 5',
      'APERTURA · FECHA 6',
      'APERTURA · FECHA 7',
      'APERTURA · FECHA 8',
      'APERTURA · FECHA 9',
      'APERTURA · FECHA 10',
      'APERTURA · FECHA 11',
      'APERTURA · FECHA 12',
      'APERTURA · FECHA 13',
      'APERTURA · FECHA 14',
      'APERTURA · FECHA 15',
      'APERTURA · FECHA 16',
      'APERTURA · 8vos de FINAL',
      'APERTURA · 4tos de FINAL',
      'APERTURA · SEMIFINAL',
      'APERTURA · FINAL',

      'CLAUSURA · FECHA 1',
      'CLAUSURA · FECHA 2',
      'CLAUSURA · FECHA 3',
      'CLAUSURA · FECHA 4',
      'CLAUSURA · FECHA 5',
      'CLAUSURA · FECHA 6',
      'CLAUSURA · FECHA 7',
      'CLAUSURA · FECHA 8',
      'CLAUSURA · FECHA 9',
      'CLAUSURA · FECHA 10',
      'CLAUSURA · FECHA 11',
      'CLAUSURA · FECHA 12',
      'CLAUSURA · FECHA 13',
      'CLAUSURA · FECHA 14',
      'CLAUSURA · FECHA 15',
      'CLAUSURA · FECHA 16',
      'CLAUSURA · 8vos de FINAL',
      'CLAUSURA · 4tos de FINAL',
      'CLAUSURA · SEMIFINAL',
      'CLAUSURA · FINAL',
    ]
        : activeCompetitionKey === 'sudamericana'
  ? [
      'PLAY-OFF',
      '8vos de FINAL',
      '4tos de FINAL',
      'SEMIFINAL',
      'FINAL',
    ]
    : activeCompetitionKey === 'mundial'
      ? [
          'FASE DE GRUPOS · FECHA 1',
          'FASE DE GRUPOS · FECHA 2',
          'FASE DE GRUPOS · FECHA 3',
          '16vos DE FINAL',
          '8vos DE FINAL',
          '4tos DE FINAL',
          'SEMIFINAL',
          '3er PUESTO',
          'FINAL',
        ]
      : []

const availableRounds = Array.from(
  new Set(
    filteredMatches
      .map(m => normalizeRound(m.round, activeCompetitionKey))
      .filter(Boolean)
  )
).sort((a, b) => {
  const ai = roundOrder.indexOf(a)
  const bi = roundOrder.indexOf(b)

  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1

  return ai - bi
})

const now = Date.now()

const votingOpenMatches = filteredMatches
  .filter(m => {
    if (m.status !== 'finished' || !m.match_end_at) return false

    const end = new Date(m.match_end_at).getTime()
    const votingClosesAt = end + 24 * 60 * 60 * 1000

    return votingClosesAt > now
  })
  .sort((a, b) => {
    const aEnd = a.match_end_at ? new Date(a.match_end_at).getTime() : 0
    const bEnd = b.match_end_at ? new Date(b.match_end_at).getTime() : 0

    return bEnd - aEnd
  })

const nextUpcomingMatch = filteredMatches
  .filter(m => m.status === 'upcoming' || m.status === 'live')
  .sort((a, b) => {
    const aTime = new Date(`${a.date}T${a.time}:00`).getTime()
    const bTime = new Date(`${b.date}T${b.time}:00`).getTime()

    return aTime - bTime
  })[0]

const defaultRound =
  votingOpenMatches[0]
    ? normalizeRound(votingOpenMatches[0].round, activeCompetitionKey)
    : nextUpcomingMatch
      ? normalizeRound(nextUpcomingMatch.round, activeCompetitionKey)
      : availableRounds[0]

const activeRound =
  typeof searchParams?.round === 'string'
    ? decodeURIComponent(searchParams.round)
    : defaultRound

const activeRoundIndex = availableRounds.indexOf(activeRound)

const previousRound =
  activeRoundIndex > 0
    ? availableRounds[activeRoundIndex - 1]
    : null

const nextRound =
  activeRoundIndex >= 0 && activeRoundIndex < availableRounds.length - 1
    ? availableRounds[activeRoundIndex + 1]
    : null

const roundMatches = isDailyView
  ? dailyMatches
  : activeRound
    ? filteredMatches.filter(
        m => normalizeRound(m.round, activeCompetitionKey) === activeRound
      )
    : filteredMatches


  const byDate: Record<string, Match[]> = {}
  for (const m of roundMatches) {
    if (!m || !m.date) continue
    if (!byDate[m.date]) byDate[m.date] = []
    byDate[m.date].push(m)
  }

  for (const date in byDate) {
  byDate[date].sort((a, b) => {

    const aFinished = a.status === 'finished'
    const bFinished = b.status === 'finished'

    // Terminados arriba
    if (aFinished && !bFinished) return -1
    if (!aFinished && bFinished) return 1

    // Entre terminados:
    // más reciente primero
    if (aFinished && bFinished) {
      const aEnd = a.match_end_at ? new Date(a.match_end_at).getTime() : 0
      const bEnd = b.match_end_at ? new Date(b.match_end_at).getTime() : 0

      return bEnd - aEnd
    }

    // Entre próximos:
    // orden cronológico normal
    return a.time.localeCompare(b.time)
  })
}

  const currentTime = Date.now()

function getDatePriority(date: string) {
  const matches = byDate[date] ?? []

  const openVotingMatches = matches
    .filter(m => m.status === 'finished' && m.match_end_at)
    .map(m => new Date(m.match_end_at as string).getTime() + 24 * 60 * 60 * 1000)
    .filter(closeTime => closeTime > currentTime)

  if (openVotingMatches.length > 0) {
    return {
      group: 1,
      time: Math.min(...openVotingMatches),
    }
  }

  const hasLive = matches.some(m => m.status === 'live')

  if (hasLive) {
    return {
      group: 2,
      time: currentTime,
    }
  }

  const hasUpcoming = matches.some(m => m.status === 'upcoming')

  if (hasUpcoming) {
    return {
      group: 3,
      time: new Date(date + 'T00:00:00').getTime(),
    }
  }

  return {
    group: 4,
    time: new Date(date + 'T00:00:00').getTime(),
  }
}

const dates = Object.keys(byDate).sort((a, b) => {
  const pa = getDatePriority(a)
  const pb = getDatePriority(b)

  if (pa.group !== pb.group) {
    return pa.group - pb.group
  }

  return pa.time - pb.time
})

const matchSections = isDailyView
  ? dailySections.map(section => ({
      key: section.competition.key,
      title: section.competition.title,
      subtitle: getDailyRoundLabel(
        section.matches,
        section.competition.key
      ),
      matches: section.matches,
    }))
  : dates.map(date => ({
      key: date,
      title: formatDate(date),
      subtitle: '',
      matches: byDate[date],
    }))

  return (
    <div style={{ background: '#0B0B0F', minHeight: '100vh' }}>
      {/* App header */}
      <header style={{
  position: 'sticky', top: 0, zIndex: 100,
  background: 'rgba(11,11,15,0.96)',
  backdropFilter: 'blur(20px)',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  height: 56,
}}>
  <div style={{
    maxWidth: 480,
    height: '100%',
    margin: '0 auto',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
  <img
    src="/logos/tango90/isotipo.svg"
    alt="Tango90"
    style={{ width: 32, height: 32, display: 'block' }}
  />
  <img
    src="/logos/tango90/wordmark.svg"
    alt="Tango90"
    style={{ height: 22, width: 'auto', display: 'block' }}
  />
</a>
        <div style={{ position: 'relative' }}>
  <button
    aria-label="Abrir menú"
    popoverTarget="competition-menu"
    style={{
      width: 32,
      height: 32,
      border: 'none',
      background: 'transparent',
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
      cursor: 'pointer',
      opacity: 1,
    }}
  >
    <span style={{ width: 22, height: 2, background: '#9CA3AF', borderRadius: 2 }} />
    <span style={{ width: 22, height: 2, background: '#9CA3AF', borderRadius: 2 }} />
    <span style={{ width: 22, height: 2, background: '#9CA3AF', borderRadius: 2 }} />
  </button>

  <div
    id="competition-menu"
    popover="auto"
    style={{
      position: 'fixed',
      inset: 'unset',
      top: 56,
      right: 'calc((100vw - min(480px, 100vw)) / 2 + 16px)',
      width: 210,
      background: '#121218',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 12,
      padding: 6,
      boxShadow: '0 18px 45px rgba(0,0,0,0.45)',
      zIndex: 200,
      margin: 0,
    }}
  >
        <Link
      href="/"
      style={{
        display: 'block',
        textDecoration: 'none',
        padding: '10px 12px',
        borderRadius: 8,
        fontFamily: PJS,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textAlign: 'right',
        color: isDailyView ? '#FBD005' : '#E5E7EB',
        background: isDailyView ? 'rgba(251,208,5,0.10)' : 'transparent',
      }}
    >
      PARTIDOS
    </Link>

    {COMPETITIONS
      .map(c => (
      <Link
        key={c.key}
        href={`/?competition=${c.key}`}
        style={{
          display: 'block',
          textDecoration: 'none',
          padding: '10px 12px',
          borderRadius: 8,
          fontFamily: PJS,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textAlign: 'right',
          color: !isDailyView && c.key === activeCompetitionKey ? '#FBD005' : '#E5E7EB',
          background: !isDailyView && c.key === activeCompetitionKey
            ? 'rgba(251,208,5,0.10)'
            : 'transparent',
        }}
      >
        {c.label}
      </Link>
    ))}
  </div>
</div>
        </div>
</header>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', paddingBottom: 48 }}>
        {/* Section label */}

{isDailyView ? (
  <div
    style={{
      padding: '20px 0 14px',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}
  >
    <div
      style={{
        fontFamily: PJS,
        fontSize: 12,
        fontWeight: 600,
        color: '#6B7280',
        letterSpacing: '0.14em',
      }}
    >
      PARTIDOS
    </div>

    <div
      style={{
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: '32px 1fr 32px',
        alignItems: 'center',
      }}
    >
      <Link
        href={`/?date=${previousDate}`}
        style={{
          fontFamily: PJS,
          color: '#F2F2F2',
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1,
          textAlign: 'left',
          textDecoration: 'none',
        }}
      >
        ‹
      </Link>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: OBJ,
            fontSize: 18,
            fontWeight: 600,
            color: '#FFFFFF',
            letterSpacing: '0.08em',
          }}
        >
          {getDateTitle(selectedDate, todayDate)}
        </div>

        <div
          style={{
            marginTop: 4,
            fontFamily: PJS,
            fontSize: 11,
            fontWeight: 600,
            color: '#6B7280',
            letterSpacing: '0.08em',
          }}
        >
          {formatFullDate(selectedDate)}
        </div>
      </div>

      <Link
        href={`/?date=${nextDate}`}
        style={{
          fontFamily: PJS,
          color: '#F2F2F2',
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1,
          textAlign: 'right',
          textDecoration: 'none',
        }}
      >
        ›
      </Link>
    </div>
  </div>
) : (
  <div
    style={{
      padding: '20px 0 14px',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: OBJ,
        fontSize: 12,
        fontWeight: 600,
        color: '#6B7280',
        letterSpacing: '0.14em',
      }}
    >
      {activeCompetition.logos.map((logo, i) => (
        <img
          key={i}
          src={logo}
          alt=""
          style={{ width: 36, height: 36, objectFit: 'contain' }}
        />
      ))}

      <span>{activeCompetition.title}</span>
    </div>

    <div
      style={{
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: '32px 1fr 32px',
        alignItems: 'center',
      }}
    >
      {previousRound ? (
        <Link
          href={`/?competition=${activeCompetitionKey}&round=${encodeURIComponent(previousRound)}`}
          style={{
            fontFamily: PJS,
            color: '#F2F2F2',
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1,
            textAlign: 'left',
            textDecoration: 'none',
          }}
        >
          ‹
        </Link>
      ) : (
        <span
          style={{
            fontFamily: PJS,
            color: 'rgba(107,114,128,0.25)',
            fontSize: 18,
            textAlign: 'left',
          }}
        >
          ‹
        </span>
      )}

      <div
        style={{
          fontFamily: OBJ,
          fontSize: 18,
          fontWeight: 600,
          color: '#FFFFFF',
          letterSpacing: '0.08em',
          textAlign: 'center',
        }}
      >
        {formatRoundLabel(activeRound, activeCompetitionKey)}
      </div>

      {nextRound ? (
        <Link
          href={`/?competition=${activeCompetitionKey}&round=${encodeURIComponent(nextRound)}`}
          style={{
            fontFamily: PJS,
            color: '#F2F2F2',
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1,
            textAlign: 'right',
            textDecoration: 'none',
          }}
        >
          ›
        </Link>
      ) : (
        <span
          style={{
            fontFamily: PJS,
            color: 'rgba(107,114,128,0.25)',
            fontSize: 18,
            textAlign: 'right',
          }}
        >
          ›
        </span>
      )}
    </div>
  </div>
)}

        {/* Match list */}

{isDailyView && matchSections.length === 0 && (
  <div
    style={{
      padding: '48px 20px',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        fontFamily: OBJ,
        fontSize: 18,
        fontWeight: 600,
        color: '#F2F2F2',
        letterSpacing: '0.04em',
      }}
    >
      NO HAY PARTIDOS
    </div>

    <div
      style={{
        marginTop: 8,
        fontFamily: PJS,
        fontSize: 12,
        fontWeight: 500,
        color: '#6B7280',
        lineHeight: 1.5,
      }}
    >
      No hay partidos programados para esta fecha.
    </div>

    {selectedDate !== todayDate && (
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          marginTop: 20,
          padding: '10px 16px',
          borderRadius: 8,
          background: '#FBD005',
          color: '#0B0B0F',
          fontFamily: PJS,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textDecoration: 'none',
        }}
      >
        VOLVER A HOY
      </Link>
    )}
  </div>
)}

{matchSections.map(section => (
          <div key={section.key}>
            <div
              style={{
                padding: '16px 0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: PJS,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#F2F2F2',
                    letterSpacing: '0.08em',
                  }}
                >
                  {section.title}
                </div>

                {section.subtitle && (
                  <div
                    style={{
                      marginTop: 3,
                      fontFamily: PJS,
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#6B7280',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {section.subtitle}
                  </div>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'rgba(255,255,255,0.06)',
                }}
              />
            </div>

            {section.matches.map(match => (
              <Link
  key={match.id}
  href={match.status === 'finished' ? `/partido/${match.id}` : '#'}
  style={{
  textDecoration: 'none',
  pointerEvents: match.status === 'finished'
    ? 'auto'
    : 'none'
}}
>
                <div
                  className="match-card"
                  style={{
                    background: '#121218',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    marginBottom: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {/* Time / status */}
                  <div style={{ minWidth: 42, textAlign: 'left', display: 'flex', alignItems: 'center' }}>
                    {match.status === 'live' ? (
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#00FED9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: OBJ,
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#000000',
                        lineHeight: 1,
                      }}>
                        {typeof (match as any).minute === 'number'
                          ? `${(match as any).minute}'`
                          : '•'}
                      </div>
                    ) : (
                      <div style={{
                        fontFamily: getMatchTimeLabel(match).includes('H') ? OBJ : PJS,
                        fontSize: getMatchTimeLabel(match).includes('H') ? 15 : 11,
                        fontWeight: getMatchTimeLabel(match).includes('H') ? 700 : 600,
                        color: getMatchTimeLabel(match).includes('H') ? getCountdownColor(match) : '#6B7280',
                        letterSpacing: getMatchTimeLabel(match).includes('H') ? '0.02em' : '0.04em',
                      }}>
                        {getMatchTimeLabel(match)}
                      </div>
                    )}
                  </div>

                  <div style={{
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1fr 26px 76px 26px 1fr',
  alignItems: 'center',
  columnGap: 8,
  height: '100%',
}}>
  {/* Home */}
  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, minWidth: 0 }}>
    <span style={{ fontFamily: OBJ, fontSize: 16, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
      {match.home.shortName}
    </span>
  </div>

  {/* Home crest */}
<div
  style={{
    width: String(match.home.badge).includes('/logos/flags/') ? 28 : 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
  {String(match.home.badge).startsWith('/') ? (
    String(match.home.badge).includes('/logos/flags/') ? (
      <div
        style={{
          width: 28,
          height: 20,
          overflow: 'hidden',
          background: 'transparent',
          border: '1px solid rgba(255,255,255)',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 9,
          borderBottomRightRadius: 0,
          borderBottomLeftRadius: 9,
        }}
      >
        <img
          src={match.home.badge}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    ) : (
      <img
        src={match.home.badge}
        alt=""
        style={{ width: 22, height: 22, objectFit: 'contain' }}
      />
    )
  ) : (
    <span style={{ fontSize: 18 }}>{match.home.badge}</span>
  )}
</div>

  {/* Center score / VS */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  }}>
    {match.status === 'upcoming' ? (
      <span style={{ fontFamily: OBJ, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em' }}>
        VS
      </span>
    ) : (() => {
      const homeScore = match.home.score
      const awayScore = match.away.score
      const ps = match.penaltyShootout

      let winner: 'home' | 'away' | null = null

      if (typeof homeScore === 'number' && typeof awayScore === 'number') {
        if (homeScore > awayScore) {
          winner = 'home'
        } else if (awayScore > homeScore) {
          winner = 'away'
        } else if (
          ps &&
          typeof ps.homeScore === 'number' &&
          typeof ps.awayScore === 'number'
        ) {
          if (ps.homeScore > ps.awayScore) {
            winner = 'home'
          } else if (ps.awayScore > ps.homeScore) {
            winner = 'away'
          }
        }
      }

      const homeScoreColor = winner === 'away'
        ? 'rgba(255,255,255,0.45)'
        : '#FFFFFF'

      const awayScoreColor = winner === 'home'
        ? 'rgba(255,255,255,0.45)'
        : '#FFFFFF'

      return (
        <>
          <span style={{ fontFamily: OBJ, fontSize: 26, fontWeight: 700, color: homeScoreColor, minWidth: 22, textAlign: 'center' }}>
            {match.home.score}
          </span>
          <span style={{ fontFamily: OBJ, fontSize: 18, color: 'rgba(255,255,255,0.25)', padding: '0 6px' }}>–</span>
          <span style={{ fontFamily: OBJ, fontSize: 26, fontWeight: 700, color: awayScoreColor, minWidth: 22, textAlign: 'center' }}>
            {match.away.score}
          </span>
        </>
      )
    })()}
  </div>

  {/* Away crest */}
<div
  style={{
    width: String(match.away.badge).includes('/logos/flags/') ? 28 : 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
  {String(match.away.badge).startsWith('/') ? (
    String(match.away.badge).includes('/logos/flags/') ? (
      <div
        style={{
          width: 28,
          height: 20,
          overflow: 'hidden',
          background: 'transparent',
          border: '1px solid rgba(255,255,255)',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 9,
          borderBottomRightRadius: 0,
          borderBottomLeftRadius: 9,
        }}
      >
        <img
          src={match.away.badge}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    ) : (
      <img
        src={match.away.badge}
        alt=""
        style={{ width: 22, height: 22, objectFit: 'contain' }}
      />
    )
  ) : (
    <span style={{ fontSize: 18 }}>{match.away.badge}</span>
  )}
</div>

  {/* Away */}
  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 6, minWidth: 0 }}>
    <span style={{ fontFamily: OBJ, fontSize: 16, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
      {match.away.shortName}
    </span>
  </div>
</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {match.status === 'live' && <LiveBadge />}
                    {match.status === 'upcoming' && <UpcomingBadge />}
                    {match.status === 'suspended' && <SuspendedBadge />}
                    {match.status === 'finished' && (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <MatchStatusBadge
      entityIds={getVotableEntityIds(processMatch(match))}
      isFinished={true}
      matchEndAt={match.match_end_at}
    />

    {formatVoteCount(voteCountsByMatchId[match.id] ?? 0) && (
      <span style={{
        position: 'absolute',
        top: '100%',
        marginTop: 2,
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: PJS,
        fontSize: 9,
        fontWeight: 500,
        color: '#F2F2F2',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        {formatVoteCount(voteCountsByMatchId[match.id] ?? 0)}
      </span>
    )}
  </div>
)}
                    
                  </div>
                </div>
              </Link>
            ))}

            <AdSlot />

          </div>
        ))}

                <AdSlot type="large" />

        <footer style={{
          marginTop: 40,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 0 12px',
        }}>
          

          <div style={{
            textAlign: 'center',
            fontSize: 11,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.38)',
            padding: '0 10px',
          }}>
            Tango90 es una plataforma independiente de calificaciones y estadísticas generadas por usuarios.
            <br />
            No afiliada a AFA, LPF, FIFA, CONMEBOL ni clubes oficiales.
            <br />
            Los nombres, escudos y marcas pertenecen a sus respectivos titulares y son utilizados únicamente con fines identificatorios e informativos.
          </div>
        </footer>
        
      </div>

      <style>{`
        .match-card:hover { border-color: rgba(108,206,255,0.2) !important; background: #16161f !important; }
      `}</style>
    </div>
  )
}
