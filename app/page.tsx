import Link from 'next/link'
import { matches } from '@/data/matches'
import { processMatch, getVotableEntityIds } from '@/lib/processMatch'
import MatchStatusBadge from '@/components/MatchStatusBadge'

const PJS = "'Plus Jakarta Sans', sans-serif"
const OBJ = "'Oswald', sans-serif"

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

export default function Home() {
  const byDate: Record<string, typeof matches> = {}
  for (const m of matches) {
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
                    alignItems: 'center',
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

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Home */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                      <span style={{ fontFamily: OBJ, fontSize: 16, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                        {match.home.shortName}
                      </span>
                      <span style={{ fontSize: 10, color: '#6B7280', whiteSpace: 'nowrap', fontFamily: PJS }}>{match.home.name}</span>
                    </div>

                    {/* Score */}
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 72, justifyContent: 'center' }}>
                      {match.status === 'upcoming' ? (
                        <span style={{ fontFamily: OBJ, fontSize: 20, fontWeight: 700, color: '#1A1A22', letterSpacing: '0.1em' }}>VS</span>
                      ) : (
                        <>
                          <span style={{ fontFamily: OBJ, fontSize: 28, fontWeight: 700, color: '#FFFFFF', minWidth: 24, textAlign: 'center' }}>
                            {match.home.score}
                          </span>
                          <span style={{ fontFamily: OBJ, fontSize: 18, color: 'rgba(255,255,255,0.2)', padding: '0 4px' }}>–</span>
                          <span style={{ fontFamily: OBJ, fontSize: 28, fontWeight: 700, color: '#FFFFFF', minWidth: 24, textAlign: 'center' }}>
                            {match.away.score}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Away */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                      <span style={{ fontFamily: OBJ, fontSize: 16, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                        {match.away.shortName}
                      </span>
                      <span style={{ fontSize: 10, color: '#6B7280', whiteSpace: 'nowrap', fontFamily: PJS }}>{match.away.name}</span>
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
