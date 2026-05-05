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
    <span style={{ background: '#ef4444', color: '#fff', fontFamily: OBJ, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em' }}>
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
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
    logos: [],
  },
  {
    key: 'mundial',
    label: 'FIFA WORLD CUP',
    title: 'COPA MUNDIAL de la FIFA',
    logos: [],
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
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours <= 0) return 'FIN'
    return `${diffHours}H`
  }

  return ''
}
type HomeProps = {
  searchParams?: {
    competition?: string
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
    .eq('published', false)
    .order('kickoff_at', { ascending: true })

    const apiMatchIds = new Set(apiMatches.map(m => m.id))
    const trackedMatches: Match[] = (trackedRows ?? [])
  .filter((row: any) => !apiMatchIds.has(row.internal_match_id))
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
    round: 'Próximo',
    stadium: '',
    status: 'upcoming',
    home: {
  id: getTeamByApiFootballId(row.home_team_id)?.teamKey ?? `api-team-${row.home_team_id}`,
  name: getTeamByApiFootballId(row.home_team_id)?.displayName ?? row.home_name,
  shortName: getTeamByApiFootballId(row.home_team_id)?.abbreviation ?? row.home_name.slice(0, 3).toUpperCase(),
  badge: getTeamByApiFootballId(row.home_team_id)?.crestPath ?? '🏟️',
  score: 0,
  players: [],
  coach: { id: `api-coach-${row.home_team_id}`, name: '' },
},
away: {
  id: getTeamByApiFootballId(row.away_team_id)?.teamKey ?? `api-team-${row.away_team_id}`,
  name: getTeamByApiFootballId(row.away_team_id)?.displayName ?? row.away_name,
  shortName: getTeamByApiFootballId(row.away_team_id)?.abbreviation ?? row.away_name.slice(0, 3).toUpperCase(),
  badge: getTeamByApiFootballId(row.away_team_id)?.crestPath ?? '🏟️',
  score: 0,
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

  const allMatches: Match[] = [...trackedMatches, ...apiMatches]

  const activeCompetitionKey = (
  searchParams?.competition &&
  COMPETITIONS.some(c => c.key === searchParams.competition)
    ? searchParams.competition
    : 'lpf'
) as CompetitionKey

const activeCompetition =
  COMPETITIONS.find(c => c.key === activeCompetitionKey) ?? COMPETITIONS[0]

const visibleCompetitions = COMPETITIONS.filter(competition =>
  allMatches.some(match => getCompetitionKey(match) === competition.key)
)

const filteredMatches = allMatches.filter(match =>
  getCompetitionKey(match) === activeCompetitionKey
)


  const byDate: Record<string, Match[]> = {}
  for (const m of filteredMatches) {
    if (!m || !m.date) continue
    if (!byDate[m.date]) byDate[m.date] = []
    byDate[m.date].push(m)
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

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
    popoverTarget="competition-menu"
    aria-label="Abrir menú"
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
    {COMPETITIONS.map(c => (
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
          color: c.key === activeCompetitionKey ? '#FBD005' : '#E5E7EB',
          background: c.key === activeCompetitionKey ? 'rgba(251,208,5,0.10)' : 'transparent',
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
        
<div style={{ padding: '20px 0 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: OBJ,
    fontSize: 12,
    fontWeight: 600,
    color: '#6B7280',
    letterSpacing: '0.14em',
  }}>
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

  <div style={{
    marginTop: 12,
    display: 'grid',
    gridTemplateColumns: '32px 1fr 32px',
    alignItems: 'center',
  }}>
    <span style={{ fontFamily: PJS, color: '#6B7280', fontSize: 18, textAlign: 'left' }}>‹</span>
    <div style={{ fontFamily: OBJ, fontSize: 18, fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.08em', textAlign: 'center' }}>
      {(allMatches[0]?.round ?? '').toUpperCase()}
    </div>
    <span style={{ fontFamily: PJS, color: '#6B7280', fontSize: 18, textAlign: 'right' }}>›</span>
  </div>
</div>

        {/* Match list */}
        {dates.map(date => (
          <div key={date}>
            <div style={{ padding: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: PJS, fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.08em' }}>
                {formatDate(date)}
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {byDate[date].map(match => (
              <Link key={match.id} href={`/partido/${match.id}`} style={{ textDecoration: 'none' }}>
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
  <div style={{ fontFamily: PJS, fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.04em' }}>
    {getMatchTimeLabel(match)}
  </div>
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
  <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {String(match.home.badge).startsWith('/') ? (
      <img src={match.home.badge} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
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
    ) : (
      <>
        <span style={{ fontFamily: OBJ, fontSize: 26, fontWeight: 700, color: '#FFFFFF', minWidth: 22, textAlign: 'center' }}>
          {match.home.score}
        </span>
        <span style={{ fontFamily: OBJ, fontSize: 18, color: 'rgba(255,255,255,0.25)', padding: '0 6px' }}>–</span>
        <span style={{ fontFamily: OBJ, fontSize: 26, fontWeight: 700, color: '#FFFFFF', minWidth: 22, textAlign: 'center' }}>
          {match.away.score}
        </span>
      </>
    )}
  </div>

  {/* Away crest */}
  <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {String(match.away.badge).startsWith('/') ? (
      <img src={match.away.badge} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
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
                    {match.status === 'finished' && (
                      <MatchStatusBadge
  entityIds={getVotableEntityIds(processMatch(match))}
  isFinished={true}
  matchEndAt={match.match_end_at}
/>
                    )}
                    
                  </div>
                </div>
              </Link>
            ))}

            <AdSlot />

          </div>
        ))}

        <AdSlot type="large" />
        
      </div>

      <style>{`
        .match-card:hover { border-color: rgba(108,206,255,0.2) !important; background: #16161f !important; }
      `}</style>
    </div>
  )
}
