import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { matches, type Match } from '@/data/matches'
import { supabaseServer } from '@/lib/supabaseServer'
import { processMatch, getVotableEntityIds } from '@/lib/processMatch'
import MatchStatusBadge from '@/components/MatchStatusBadge'
import { getTeamByApiFootballId } from '@/data/teams'

const PJS = "'Plus Jakarta Sans', sans-serif"
const OBJ = "'Oswald', sans-serif"
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

export default async function Home() {
  noStore()

  const { data: apiRows, error } = await supabaseServer
    .from('matches_api')
    .select('data')
    .order('updated_at', { ascending: false })

  const apiMatches: Match[] = error
  ? []
  : (apiRows ?? [])
      .map(row => row.data as Match)
      .filter(m => m && m.id && m.date)
      .map(m => ({
        ...m,
        home: {
          ...m.home,
          id: getTeamByApiFootballId(Number(String(m.home.id).replace('api-team-', '')))?.teamKey ?? m.home.id,
          name: getTeamByApiFootballId(Number(String(m.home.id).replace('api-team-', '')))?.displayName ?? m.home.name,
          shortName: getTeamByApiFootballId(Number(String(m.home.id).replace('api-team-', '')))?.abbreviation ?? m.home.shortName,
          badge: getTeamByApiFootballId(Number(String(m.home.id).replace('api-team-', '')))?.crestPath ?? m.home.badge,
        },
        away: {
          ...m.away,
          id: getTeamByApiFootballId(Number(String(m.away.id).replace('api-team-', '')))?.teamKey ?? m.away.id,
          name: getTeamByApiFootballId(Number(String(m.away.id).replace('api-team-', '')))?.displayName ?? m.away.name,
          shortName: getTeamByApiFootballId(Number(String(m.away.id).replace('api-team-', '')))?.abbreviation ?? m.away.shortName,
          badge: getTeamByApiFootballId(Number(String(m.away.id).replace('api-team-', '')))?.crestPath ?? m.away.badge,
        },
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
    date: row.fixture_date,
    time: new Date(row.kickoff_at).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    }),
    tournament: 'Liga Profesional Argentina',
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

  const byDate: Record<string, Match[]> = {}
  for (const m of allMatches) {
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
        display: 'flex', alignItems: 'center',
        padding: '0 16px', justifyContent: 'space-between',
      }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: '#6CCEFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#0B0B0F', fontFamily: PJS, lineHeight: 1 }}>90</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF', fontFamily: PJS, letterSpacing: '-0.01em' }}>
            TANGO<span style={{ color: '#6CCEFF' }}>90</span>
          </span>
        </a>
        <span style={{ fontSize: 11, color: '#6B7280', fontFamily: PJS, fontWeight: 500 }}>calificá el fútbol</span>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', paddingBottom: 48 }}>
        {/* Section label */}
        <div style={{ padding: '20px 0 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h1 style={{ fontFamily: OBJ, fontSize: 12, fontWeight: 600, color: '#6B7280', letterSpacing: '0.14em', margin: 0 }}>
            LIGA PROFESIONAL · FECHA 10
          </h1>
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
                  {/* Round indicator */}
                  <div style={{ minWidth: 32, textAlign: 'center' }}>
                    <div style={{ fontFamily: OBJ, fontSize: 11, color: '#6B7280', letterSpacing: '0.04em' }}>
                      {match.status === 'upcoming' ? match.time : match.round.split(' ')[1] ? `F${match.round.split(' ')[1]}` : match.round}
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
                      />
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>

      <style>{`
        .match-card:hover { border-color: rgba(108,206,255,0.2) !important; background: #16161f !important; }
      `}</style>
    </div>
  )
}
