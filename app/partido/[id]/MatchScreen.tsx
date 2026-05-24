'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { Match, MatchEvent } from '@/data/matches'
import type { ProcessedMatch, ProcessedPlayer } from '@/lib/processMatch'
import { formatEventMinute } from '@/lib/formatMinute'
import { getAnonId } from '@/lib/anonId'
import { getMatchPhase, canVote, formatRemainingTime } from '@/lib/matchPhase'
import type { PlaqueMeta } from '@/app/api/votes/route'
import type { EntityAverage, MatchAveragesResponse } from '@/app/api/votes/match-averages/route'
import AdSlot from '@/components/AdSlot'


// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg:          '#0B0B0F',
  s1:          '#121218',
  s2:          '#1A1A22',
  s3:          '#22222C',
  border:      '#25252E',
  text:        '#FFFFFF',
  text2:       '#B0B3C0',
  text3:       '#6B6E7E',
  accent:      '#BF9106',
  accentDim:   'rgba(108,206,255,0.10)',
  accentBorder:'rgba(108,206,255,0.25)',
}

// ── Visibilidad de promedios según fase ──────────────────────────────────
// voting_open_blind: mostrar avg solo si el usuario ya votó esa entidad
// voting_open / voting_closed: mostrar siempre
function getDisplayScore(
  phase: ReturnType<typeof getMatchPhase>['phase'],
  myVote: number | null,
  serverAvg: number | null,
): number | null {
  if (phase === 'voting_open_blind' && myVote === null) return null
  return myVote ?? serverAvg
}

// ── Rating helpers ────────────────────────────────────────────────────────
function ratingBg(score: number): string {
  if (score < 4) return '#B91D34'       // rojo
  if (score < 7) return '#F39C12'       // amarillo
  if (score < 10) return '#1DB954'       // verde
  return '#FBD005'                      // dorado
}
function ratingLabel(score: number): string { return score.toFixed(2) }

// ── Storage helpers — same keys as existing system, do NOT change ─────────
function readVote(entityId: string): number | null {
  try { return JSON.parse(localStorage.getItem('tango90_myvotes') || '{}')[entityId] ?? null }
  catch { return null }
}
function readStats(entityId: string): { sum: number; count: number } | null {
  try {
    const r = JSON.parse(localStorage.getItem('tango90_ratings') || '{}')[entityId]
    return r?.count > 0 ? r : null
  } catch { return null }
}
function saveVote(entityId: string, value: number): { sum: number; count: number } {
  const votes = JSON.parse(localStorage.getItem('tango90_myvotes') || '{}')
  votes[entityId] = value
  localStorage.setItem('tango90_myvotes', JSON.stringify(votes))
  const ratings = JSON.parse(localStorage.getItem('tango90_ratings') || '{}')
  const prev = ratings[entityId] || { sum: 0, count: 0 }
  ratings[entityId] = { sum: prev.sum + value, count: prev.count + 1 }
  localStorage.setItem('tango90_ratings', JSON.stringify(ratings))
  return ratings[entityId]
}
function cacheMyVote(entityId: string, value: number) {
  try {
    const votes = JSON.parse(localStorage.getItem('tango90_myvotes') || '{}')
    votes[entityId] = value
    localStorage.setItem('tango90_myvotes', JSON.stringify(votes))
  } catch {}
}
// ── Pitch constants ───────────────────────────────────────────────────────
const PITCH_W = 369
const PITCH_H = 568
// Total chip height: circle(32) + gap(5) + name(13) + gap(4) + pill(20) = 74px
// Position anchor: centre of the circle
const CHIP_ABOVE = 16  // circle radius
const CHIP_BELOW = 5 + 13 + 4 + 20  // gap + name + gap + pill = 42

type PitchLine = 'ARQ' | 'DEF' | 'MID' | 'FWD'

function getLine(pos: string): PitchLine {
  if (pos === 'ARQ') return 'ARQ'
  if (pos === 'LAD' || pos === 'DFC' || pos === 'LAI') return 'DEF'
  if (pos === 'MC') return 'MID'
  return 'FWD'
}

// Y of the circle centre for each line (kept within CHIP_ABOVE…PITCH_H-CHIP_BELOW)
const LINE_Y_HOME: Record<PitchLine, number> = { ARQ: 56, DEF: 150, MID: 294, FWD: 475 }
const LINE_Y_AWAY: Record<PitchLine, number> = { ARQ: 485, DEF: 390, MID: 264, FWD: 110 }

function chipXPositions(count: number): number[] {
  if (count === 1) return [PITCH_W / 2]
  const margin = 44
  const span = PITCH_W - margin * 2
  return Array.from({ length: count }, (_, i) => margin + (span / (count - 1)) * i)
}

function parseGrid(grid?: string) {
  if (!grid) return null

  const [rowRaw, colRaw] = grid.split(':')
  const row = Number(rowRaw)
  const col = Number(colRaw)

  if (!Number.isFinite(row) || !Number.isFinite(col)) return null

  return { row, col }
}

function getGridX(col: number, maxCol: number) {
  const center = PITCH_W / 2

  if (maxCol <= 1) return center

  // Líneas de 2 jugadores: doble 5, dupla de delanteros, doble central, etc.
  // No van a los extremos: quedan cerrados y futboleros.
  if (maxCol === 2) {
    const gap = 52
    return col === 1 ? center - gap : center + gap
  }

  // Líneas de 3 jugadores: izquierda, centro, derecha, pero no pegados al borde.
  if (maxCol === 3) {
    const gap = 95
    if (col === 1) return center - gap
    if (col === 2) return center
    return center + gap
  }

  // Líneas de 4 o más: usar ancho completo.
  const sidePadding = 54
  const usableW = PITCH_W - sidePadding * 2
  return sidePadding + ((col - 1) / (maxCol - 1)) * usableW
}

function getGridY(row: number, isHome: boolean) {
  const top = 72
  const bottom = PITCH_H - 72
  const step = (bottom - top) / 4

  const yHome = top + (row - 1) * step
  return isHome ? yHome : PITCH_H - yHome
}

function getVisualOffset(player: ProcessedPlayer, row: number, col: number, maxCol: number) {
  const pos = player.position

  let x = 0
  let y = 0

  const isWide = maxCol >= 4 && (col === 1 || col === maxCol)
  const isCenter = maxCol <= 2 || (col > 1 && col < maxCol)

  // Defensa: laterales más adelantados, centrales más bajos
  if (row === 2) {
    if (isWide) {
      // Laterales
      y += 0
      x += col === 1 ? -6 : 6
    } else {
      // Centrales
      y -= 20
      x += col <= maxCol / 2 ? 6 : -6
    }
  }

  // Volantes centrales: escalonar levemente
  if (pos === 'MC') {
    if (isCenter) y -= 10
    if (isWide) y += 10
  }

  // Extremos: abiertos, pero no tan arriba como 9
  if (pos === 'DEL' && isWide) {
    y -= 10
    x += col === 1 ? -8 : 8
  }

    // Centrodelantero: más adelantado y centrado
  if (pos === 'CDEL') {
    y += 18
    if (maxCol === 2) x += col === 1 ? 10 : -10
  }

  // Dos delanteros: dupla de ataque, cerrados pero no encima del 9
  if (row >= 4 && maxCol === 2) {
    y += 22
    x += col === 1 ? -34 : 34
  }

  return { x, y }
}

function formatPlayerShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]

  const firstInitial = parts[0][0]
  const lastName = parts.slice(1).join(' ')
  return `${firstInitial}. ${lastName}`
}

function formatCompetitionName(name: string) {
  if (name === 'Liga Profesional Argentina') {
    return 'LPF'
  }

  return name.toUpperCase()
}

function formatCompetitionShortName(name: string) {
  if (name === 'Liga Profesional Argentina') {
    return 'LPF'
  }

  return name.toUpperCase()
}

function getCompetitionKeyFromTournament(tournament?: string) {
  const t = (tournament ?? '').toLowerCase()

  if (t.includes('libertadores')) return 'libertadores'
  if (t.includes('sudamericana')) return 'sudamericana'
  if (t.includes('world cup') || t.includes('mundial')) return 'mundial'

  return 'lpf'
}

function formatRoundLabel(round?: string, competitionKey?: string) {
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
      if (r.includes('2nd')) return 'OCTAVOS DE FINAL · VUELTA'
      return 'OCTAVOS DE FINAL · IDA'
    }

    if (r.includes('quarter')) {
      if (r.includes('2nd')) return 'CUARTOS DE FINAL · VUELTA'
      return 'CUARTOS DE FINAL · IDA'
    }

    if (r.includes('semi')) {
      if (r.includes('2nd')) return 'SEMIFINAL · VUELTA'
      return 'SEMIFINAL · IDA'
    }

    if (r === 'final') {
      return 'FINAL'
    }
  }

  // ── LPF ──────────────────────────────────────────────────────
  if (competitionKey === 'lpf') {
    const fechaMatch = r.match(/fecha\s*(\d+)/)

    if (fechaMatch) {
      return `APERTURA · FECHA ${fechaMatch[1]}`
    }

    if (r.includes('round of 16')) return 'APERTURA · OCTAVOS DE FINAL'
    if (r.includes('quarter')) return 'APERTURA · CUARTOS DE FINAL'
    if (r.includes('semi')) return 'APERTURA · SEMIFINAL'
    if (r === 'final') return 'APERTURA · FINAL'
  }

  return round.toUpperCase()
}

function ratingColor(score: number) {
  if (score >= 8) return '#22C55E'   // verde
  if (score >= 6) return '#EAB308'   // amarillo
  return '#EF4444'                   // rojo
}

// ── Types ─────────────────────────────────────────────────────────────────
type VotingTarget = {
  entityId:   string    // "{matchId}_{targetId}" — used as localStorage key
  matchId:    string    // for API calls
  targetId:   string    // player/coach/referee id
  targetType: 'player' | 'coach' | 'referee'
  name:       string
  number?:    number
  position?:  string
  minutesPlayed?: number
  eligible:   boolean
}

type Props = {
  match: Match
  processed: ProcessedMatch
}

// ── Max column width for all content ──────────────────────────────────────
const MAX_W = 680

// ── Tipos de progreso/placa para MatchScreen ─────────────────────────────
type ProgressState = {
  voted:               number
  total:               number
  homeComplete:        boolean
  awayComplete:        boolean
  allComplete:         boolean
  homePlayersComplete: boolean
  awayPlayersComplete: boolean
  plaques:             Array<{ type: 'team' | 'match'; teamId?: string }>
} | null

// ── Main component ────────────────────────────────────────────────────────
export default function MatchScreen({ match, processed }: Props) {
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')
  const [compact, setCompact] = useState(false)
  const [voting, setVoting] = useState<VotingTarget | null>(null)
  const [voteSignal, setVoteSignal] = useState(0)
  const [progress, setProgress]   = useState<ProgressState>(null)
  const [averages, setAverages]   = useState<MatchAveragesResponse | null>(null)
  const [toastPlaques, setToastPlaques] = useState<PlaqueMeta[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  const isFinished = match.status === 'finished'
  const headerH = compact ? 56 : 72

  // Fase del partido (se recalcula al montar; suficiente para la sesión)
  const phase = getMatchPhase(match.match_end_at).phase
  const votingOpen = canVote(phase)

  // Scroll → compact header
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Vote event bus
  useEffect(() => {
    const refresh = () => setVoteSignal(s => s + 1)
    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [])

  // Cargar progreso + promedios del servidor al montar y después de cada voto
  useEffect(() => {
    if (!isFinished) return
    const anonId = getAnonId()
    Promise.all([
      fetch(`/api/votes/progress?match_id=${match.id}&anon_id=${anonId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/votes/match-averages?match_id=${match.id}&anon_id=${anonId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([progressData, avgData]) => {
      if (progressData) setProgress(progressData)
      if (avgData)      setAverages(avgData)
    })
  }, [match.id, isFinished, voteSignal])

  const openVoting = useCallback((target: VotingTarget) => {
    if (!votingOpen) return       // no abrir si la fase no lo permite
    if (!target.eligible) return  // no abrir si la entidad no es votable
    setVoting(target)
  }, [votingOpen])
  const closeVoting = useCallback(() => setVoting(null), [])

  // FIX 6: clicking a tab scrolls to content so tabs end up just below the compact header
  const handleTabClick = useCallback((side: 'home' | 'away') => {
    setActiveTeam(side)
    setCompact(true)
    // Small delay to let React re-render the tab sticky position (headerH → 56)
    requestAnimationFrame(() => {
      if (!contentRef.current || !tabsRef.current) return
      const tabsBottom = tabsRef.current.getBoundingClientRect().bottom + window.scrollY
      const targetScroll = tabsBottom - 56 - 48  // 56 compact header, 48 tabs height
      window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
    })
  }, [])

  const handleVoteSaved = useCallback((newPlaques: PlaqueMeta[]) => {
    setVoteSignal(s => s + 1)
    window.dispatchEvent(new CustomEvent('tango90:vote-saved'))
    if (newPlaques.length > 0) {
      setToastPlaques(prev => [...prev, ...newPlaques])
      // Limpiar toasts después de 5 segundos
      setTimeout(() => setToastPlaques([]), 5000)
    }
  }, [])

  const team = activeTeam === 'home' ? processed.home : processed.away
  const isHome = activeTeam === 'home'
  const visualTeam = activeTeam === 'home' ? match.home : match.away
  const changes   = isHome ? processed.home.validSubstitutions   : processed.away.validSubstitutions
  const subsLimit = isHome ? processed.home.availableSubstitutionsLimit : processed.away.availableSubstitutionsLimit

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 48 }}>

      {/* ── FIX 1: Sticky App Header — full-width bg, max-width inner content ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: headerH,
        background: 'rgba(11,11,15,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
        transition: 'height 220ms cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}>
        {/* Inner column — same maxWidth as all other content */}
        <div style={{
          maxWidth: MAX_W, margin: '0 auto', height: '100%',
          padding: '0 16px',
          display: 'flex', alignItems: 'center',
        }}>
          <Link
  href="/"
  style={{
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: compact ? 10 : 0,
    flexDirection: compact ? 'row' : 'column',
    transition: 'all 220ms ease',
  }}
>
  <img
    src="/logos/tango90/isotipo.svg"
    alt="Tango90"
    style={{
      width: compact ? 30 : 36,
      height: compact ? 30 : 36,
      display: 'block',
      transition: 'all 220ms ease',
    }}
  />
  <img
    src="/logos/tango90/wordmark.svg"
    alt="Tango90"
    style={{
      height: compact ? 18 : 16,
      width: 'auto',
      display: 'block',
      marginTop: compact ? 0 : 6,
      transition: 'all 220ms ease',
    }}
  />
</Link>
          <div style={{ flex: 1 }} />
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 20, height: 2, background: C.text2, borderRadius: 1 }} />)}
          </button>
        </div>
      </header>

      {/* ── Match Header ─────────────────────────────────────────────────── */}
      <MatchHeader match={match} processed={processed} />

      <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '0 16px' }}>
  <AdSlot />
</div>

      {/* ── Team Tabs — sticky below compact header ───────────────────────── */}
      <div
        ref={tabsRef}
        style={{
          position: 'sticky', top: headerH, zIndex: 90,
          background: C.bg,
          borderBottom: `1px solid ${C.border}`,
          transition: 'top 220ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{ display: 'flex', height: 48, maxWidth: MAX_W, margin: '0 auto' }}>
          {(['home', 'away'] as const).map(side => {
            const t = side === 'home' ? processed.home : processed.away
            const teamAvg = side === 'home' ? (averages?.homeTeamAvg ?? null) : (averages?.awayTeamAvg ?? null)

            const eligiblePlayers = t.players.filter(p => p.eligibleForVoting)
            const myVotes = eligiblePlayers
              .map(p => ({
                vote: averages?.byTarget?.[p.id]?.myVote ?? null,
                weight: p.impactMinutes,
              }))
              .filter(v => v.vote !== null && v.weight > 0)

            const myTeamAvg =
              myVotes.length === eligiblePlayers.length
                ? myVotes.reduce((sum, v) => sum + (v.vote as number) * v.weight, 0) /
                  myVotes.reduce((sum, v) => sum + v.weight, 0)
                : null

            return (
              <TeamTab
                key={side}
                team={t}
                isActive={activeTeam === side}
                myTeamAvg={myTeamAvg}
                teamAvg={teamAvg}
                onClick={() => handleTabClick(side)}
              />
            )
          })}
        </div>
      </div>

      {/* ── Team Content ─────────────────────────────────────────────────── */}
      <div ref={contentRef} style={{ maxWidth: MAX_W, margin: '0 auto', padding: '20px 16px 0' }}>
        {!isFinished ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            color: C.text3, fontSize: 13, fontWeight: 500, letterSpacing: '0.06em',
          }}>
            LAS CALIFICACIONES ESTARÁN DISPONIBLES CUANDO TERMINE EL PARTIDO
          </div>
        ) : (
          <>
            <PitchSection
              players={team.players}
              matchId={match.id}
              isHome={isHome}
              primaryColor={(visualTeam as any).primaryColor}
              secondaryColor={(visualTeam as any).secondaryColor}
              avgsMap={averages?.byTarget ?? {}}
              phase={phase}
              onOpen={openVoting}
            />

            <AdSlot />

            <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.text3, marginBottom: 8, paddingLeft: 4 }}>
              DIRECTOR TÉCNICO
            </div>

            <CoachRow
              matchId={match.id}
              coach={team.coach}
              changes={changes}
              subsLimit={subsLimit}
              avgData={averages?.byTarget[team.coach.id]}
              phase={phase}
              onOpen={openVoting}
            />
          </div>

            <SubsList
              players={team.players}
              matchId={match.id}
              primaryColor={(visualTeam as any).primaryColor}
              secondaryColor={(visualTeam as any).secondaryColor}
              avgsMap={averages?.byTarget ?? {}}
              phase={phase}
              onOpen={openVoting}
            />

            {/* FIX 7: Árbitro always shown for both teams — NOT conditional on activeTeam */}
            <RefereeRow
              matchId={match.id}
              referee={match.referee}
              avgData={averages?.byTarget[match.referee.id]}
              phase={phase}
              onOpen={openVoting}
            />

            <AdSlot type="large" />
            
          </>
        )}
      </div>

      {/* ── Barra de progreso ────────────────────────────────────────────── */}
      {isFinished && progress && (
        <ProgressBar
          voted={progress.voted}
          total={progress.total}
          phase={phase}
        />
      )}

      {/* ── Fase: banner si está cerrada ────────────────────────────────── */}
      {isFinished && phase === 'voting_closed' && (
  <div style={{ marginTop: 20 }}>
    <ClosedBanner />
  </div>
)}

      {/* ── Voting Bottom Sheet ───────────────────────────────────────────── */}
      <VotingSheet
        target={voting}
        onClose={closeVoting}
        onVoteSaved={handleVoteSaved}
        phase={phase}
      />

      {/* ── Toast de placas ──────────────────────────────────────────────── */}
      {toastPlaques.length > 0 && (
        <PlaquesToast plaques={toastPlaques} onDismiss={() => setToastPlaques([])} />
      )}
    </div>
  )
}

// ── Match Header ──────────────────────────────────────────────────────────
function MatchHeader({ match, processed }: { match: Match; processed: ProcessedMatch }) {
  const isFinished = match.status === 'finished'
  const ps = processed.penaltyShootout

  const homeGoals = processed.events.filter(e => e.type === 'goal'     && e.team === 'home').sort((a,b) => a.minute - b.minute)
  const awayGoals = processed.events.filter(e => e.type === 'goal'     && e.team === 'away').sort((a,b) => a.minute - b.minute)
  const homeReds  = processed.events.filter(e => e.type === 'red_card' && e.team === 'home').sort((a,b) => a.minute - b.minute)
  const awayReds  = processed.events.filter(e => e.type === 'red_card' && e.team === 'away').sort((a,b) => a.minute - b.minute)

  const nameById = new Map<string, string>()
  for (const p of [...processed.home.players, ...processed.away.players])
    nameById.set(p.id, formatPlayerShortName(p.name))

  return (
    <div style={{ background: C.s1, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '14px 16px 12px' }}>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <p style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: C.text3,
            textTransform: 'uppercase',
          }}>
  {formatCompetitionShortName(match.tournament)} · {formatRoundLabel(match.round, getCompetitionKeyFromTournament(match.tournament))}
</p>


          <p style={{ margin: '3px 0 0', fontSize: 11, color: C.text3 }}>
            {match.stadium}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, textAlign: 'right', paddingRight: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{(match.home as any).displayName || match.home.name}</div>
          </div>

          <div style={{ textAlign: 'center', minWidth: 92 }}>
            {isFinished ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {ps && <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>({ps.homeScore})</span>}
                  <span style={{ fontSize: 38, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: '-0.03em' }}>{match.home.score}</span>
                  <span style={{ fontSize: 22, color: C.text3, margin: '0 2px' }}>–</span>
                  <span style={{ fontSize: 38, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: '-0.03em' }}>{match.away.score}</span>
                  {ps && <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>({ps.awayScore})</span>}
                </div>
                
              </>
            ) : match.status === 'live' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 52, fontWeight: 800, color: C.text, lineHeight: 1 }}>{match.home.score}</span>
                  <span style={{ fontSize: 22, color: C.text3 }}>–</span>
                  <span style={{ fontSize: 52, fontWeight: 800, color: C.text, lineHeight: 1 }}>{match.away.score}</span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', padding: '2px 10px', borderRadius: 20 }}>● EN VIVO</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text3 }}>vs</div>
            )}
          </div>

          <div style={{ flex: 1, paddingLeft: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{(match.away as any).displayName || match.away.name}</div>
          </div>
        </div>

        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <EventBlock icon="⚽" homeEvents={homeGoals} awayEvents={awayGoals} nameById={nameById} />
        )}
        {(homeReds.length > 0 || awayReds.length > 0) && (
          <EventBlock icon="🟥" homeEvents={homeReds} awayEvents={awayReds} nameById={nameById} />
        )}
      </div>
    </div>
  )
}

function EventBlock({ icon, homeEvents, awayEvents, nameById }: {
  icon: string; homeEvents: MatchEvent[]; awayEvents: MatchEvent[]; nameById: Map<string, string>
}) {
  function label(e: MatchEvent): string {
    return (e.type === 'goal' || e.type === 'red_card') ? (nameById.get(e.playerId) ?? '') : ''
  }
  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        {homeEvents.map((e, i) => (
          <span key={i} style={{ fontSize: 11, color: C.text2, textAlign: 'right' }}>
            {label(e)} {formatEventMinute(e.period, e.minuteInPeriod, e.minute)}
          </span>
        ))}
      </div>
      <div style={{ width: 40, textAlign: 'center', fontSize: 14, paddingTop: 1, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {awayEvents.map((e, i) => (
          <span key={i} style={{ fontSize: 11, color: C.text2 }}>
            {formatEventMinute(e.period, e.minuteInPeriod, e.minute)} {label(e)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── FIX 5: Team Tab — badge slot ready for flag asset ─────────────────────
function TeamTab({ team, isActive, myTeamAvg, teamAvg, onClick }: {
  team: ProcessedMatch['home']
  isActive: boolean
  myTeamAvg: number | null
  teamAvg: number | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: isActive ? C.accentDim : 'transparent',
        border: 'none',
        borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
        cursor: 'pointer', padding: '0 12px',
        transition: 'all 180ms ease',
      }}
    >
      <span
        style={{ fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center' }}
        title={team.name}
        aria-label={`${team.name} badge`}
      >
        {String(team.badge).startsWith('/') ? (
  <img
    src={team.badge}
    alt=""
    style={{
      width: isActive ? 28 : 20,
      height: isActive ? 28 : 20,
      objectFit: 'contain',
      display: 'block',
      opacity: isActive ? 1 : 0.5,
      filter: isActive ? 'none' : 'grayscale(100%)',
      transition: 'all 180ms ease',
    }}
  />
) : (
  team.badge
)}
      </span>
      {myTeamAvg !== null && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: ratingBg(myTeamAvg), padding: '1px 7px', borderRadius: 6 }}>
          {ratingLabel(myTeamAvg)}
        </span>
      )}

      {teamAvg !== null && (
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
          {ratingLabel(teamAvg)}
        </span>
      )}
    </button>
  )
}

// ── Pitch Section ─────────────────────────────────────────────────────────
function PitchSection({ players, matchId, isHome, primaryColor, secondaryColor, avgsMap, phase, onOpen }: {
  players: ProcessedPlayer[]; matchId: string; isHome: boolean
primaryColor?: string; secondaryColor?: string
  avgsMap: Record<string, EntityAverage>
  phase: ReturnType<typeof getMatchPhase>['phase']
  onOpen: (t: VotingTarget) => void
}) {
  const starters = players.filter(p => p.starter)
  const lineY = isHome ? LINE_Y_HOME : LINE_Y_AWAY
  const lines: PitchLine[] = isHome ? ['ARQ','DEF','MID','FWD'] : ['FWD','MID','DEF','ARQ']

  const byLine: Record<PitchLine, ProcessedPlayer[]> = {
  ARQ: [],
  DEF: [],
  MID: [],
  FWD: [],
  }

  for (const p of starters) {
    byLine[getLine(p.position)].push(p)
  }

    // Orden horizontal:
    // - local: dejar el orden original que ya venía bien
    // - visitante: invertir solo el eje horizontal
    for (const line of Object.keys(byLine) as PitchLine[]) {
      if (!isHome) {
        byLine[line].reverse()
      }
    }

  return (
    // FIX 2/3: overflow visible so chip labels render outside circle bounds
    // The chips are positioned absolutely; we must NOT use overflow:hidden here
    <div style={{ position: 'relative', width: PITCH_W, height: PITCH_H, margin: '0 auto' }}>

      {/* Pitch background with subtle premium atmosphere */}
<div style={{
  position: 'absolute',
  inset: 0,
  borderRadius: 0,
  overflow: 'hidden',
  background: `
    radial-gradient(circle at 50% 48%,
      rgba(255,255,255,0.045) 0%,
      rgba(255,255,255,0.018) 28%,
      rgba(0,0,0,0.00) 55%
    ),
    radial-gradient(circle at 50% 50%,
      rgba(0,0,0,0.00) 0%,
      rgba(0,0,0,0.10) 72%,
      rgba(0,0,0,0.28) 100%
    ),
    repeating-linear-gradient(
      to bottom,
      #0D2B14 0px,
      #0D2B14 71px,
      #0D2A14 71px,
      #0D2A14 142px
    )
  `,
}} />

{/* Ultra subtle organic grain */}
<div style={{
  position: 'absolute',
  inset: 0,
  borderRadius: 0,
  pointerEvents: 'none',
  opacity: 0.035,
  mixBlendMode: 'soft-light',
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.22) 0 1px, transparent 1px),
    radial-gradient(circle at 70% 60%, rgba(255,255,255,0.18) 0 1px, transparent 1px),
    radial-gradient(circle at 45% 80%, rgba(0,0,0,0.18) 0 1px, transparent 1px)
  `,
  backgroundSize: '18px 18px, 22px 22px, 26px 26px',
}} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 0,
        background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.3) 100%)',
        pointerEvents: 'none',
      }} />

      {/* FIX 4: Simplified, clean pitch markings SVG */}
      <svg
        width={PITCH_W} height={PITCH_H}
        viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
        style={{ position: 'absolute', top: 0, left: 0, borderRadius: 20, overflow: 'hidden' }}
      >
        <g stroke="rgba(255,255,255,0.08)" fill="none" strokeWidth="1.25">
          {/* Outer boundary */}
          <rect x="14" y="14" width={PITCH_W - 28} height={PITCH_H - 28} />
          {/* Center line */}
          <line x1="14" y1={PITCH_H / 2} x2={PITCH_W - 14} y2={PITCH_H / 2} />
          {/* Center circle */}
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="46" />
          {/* Center spot */}
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="2.5" fill="rgba(255,255,255,0.16)" />

          {/* Top penalty area */}
          <path d="M 84 14 L 84 99 L 286 99 L 286 14" />
          {/* Top goal area */}
          <path d="M 139 14 L 139 42 L 231 42 L 231 14" />
          {/* Top penalty spot */}
          <circle cx={PITCH_W / 2} cy="71" r="2.5" fill="rgba(255,255,255,0.16)" />
          {/* Top penalty arc — small, outside the area, correct orientation */}
          <path d={`M 148 99 A 46 46 0 0 0 221 99`} />

          {/* Bottom penalty area */}
          <path d={`M 84 ${PITCH_H - 14} L 84 ${PITCH_H - 99} L 286 ${PITCH_H - 99} L 286 ${PITCH_H - 14}`} />
          {/* Bottom goal area */}
          <path d={`M 139 ${PITCH_H - 14} L 139 ${PITCH_H - 42} L 231 ${PITCH_H - 42} L 231 ${PITCH_H - 14}`} />
          {/* Bottom penalty spot */}
          <circle cx={PITCH_W / 2} cy={PITCH_H - 71} r="2.5" fill="rgba(255,255,255,0.16)" />
          {/* Bottom penalty arc — outside the area, correct orientation */}
          <path d={`M 148 ${PITCH_H - 99} A 46 46 0 0 1 221 ${PITCH_H - 99}`} />
        </g>
      </svg>

      {/* Player chips — rendered OUTSIDE the overflow:hidden pitch background */}
      {lines.map(line => {
  const linePlayers = byLine[line]
  if (!linePlayers.length) return null

  const allHaveGrid = linePlayers.every(p => parseGrid(p.grid))

  if (!allHaveGrid) {
    const xs = chipXPositions(linePlayers.length)
    const y  = lineY[line]

    return linePlayers.map((p, i) => (
      <PlayerChip
        key={p.id}
        player={p}
        matchId={matchId}
        cx={xs[i]}
        cy={y}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        avgData={avgsMap[p.id]}
        phase={phase}
        onOpen={onOpen}
      />
    ))
  }

  return linePlayers.map(p => {
    const grid = parseGrid(p.grid)!
    const sameGridRow = starters
      .map(s => parseGrid(s.grid))
      .filter(g => g && g.row === grid.row)

    const maxCol = Math.max(...sameGridRow.map(g => g!.col))
    const visualCol = isHome ? maxCol - grid.col + 1 : grid.col
    const baseX = getGridX(visualCol, maxCol)
    const baseY = getGridY(grid.row, isHome)
    const offset = getVisualOffset(p, grid.row, visualCol, maxCol)

    return (
      <PlayerChip
        key={p.id}
        player={p}
        matchId={matchId}
        cx={baseX + offset.x}
        cy={baseY + (isHome ? offset.y : -offset.y)}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        avgData={avgsMap[p.id]}
        phase={phase}
        onOpen={onOpen}
      />
    )
  })
})}
    </div>
  )
}

// ── FIX 2: Player Chip — no fixed height so name + pill render correctly ──
function PlayerChip({ player, matchId, cx, cy, primaryColor, secondaryColor, avgData, phase, onOpen }: {
  player: ProcessedPlayer; matchId: string; cx: number; cy: number
  primaryColor?: string; secondaryColor?: string
  avgData: EntityAverage | undefined
  phase: ReturnType<typeof getMatchPhase>['phase']
  onOpen: (t: VotingTarget) => void
}) {
  // myVote desde localStorage para feedback inmediato post-voto,
  // antes de que el servidor responda con avgData actualizado.
  const entityId = `${matchId}_${player.id}`
  const [localVote, setLocalVote] = useState<number | null>(null)

  useEffect(() => {
    const refresh = () => setLocalVote(readVote(entityId))

    refresh()

    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [entityId])

  const myVote       = avgData?.myVote ?? localVote
  // Si el servidor aún no devolvió avg pero el usuario ya votó,
  // usamos myVote como fallback (avg de 1 solo voto = ese voto).
  const serverAvg = avgData?.avg ?? null
  const displayScore = getDisplayScore(phase, myVote, serverAvg)
  const hasVoted     = myVote !== null

  const showAvg =
    phase === 'voting_open_blind'
      ? hasVoted && serverAvg !== null
      : serverAvg !== null
  const wasSubbedOut = player.status === 'starter_subbed_out' || player.status === 'sub_entered_subbed_out'
  const wasRedCarded = player.status === 'starter_red_card'   || player.status === 'sub_entered_red_card'
  const hasEvents = player.goals > 0 || wasRedCarded || wasSubbedOut

  // Position: anchor on the circle centre (cx, cy). Button top = cy - CHIP_ABOVE
  // No height set → button is as tall as its content → name/pill always render
  return (
    <button
      onClick={() => {
        if (!player.eligibleForVoting) return
        onOpen({
          entityId:   entityId,
          matchId:    matchId,
          targetId:   player.id,
          targetType: 'player',
          name:       player.name,
          number:     player.number,
          position:   player.position,
          minutesPlayed: player.derivedMinutesPlayed,
          eligible:   player.eligibleForVoting,
        })
      }}
      style={{
        position: 'absolute',
        left: cx - 36,           // centre the 64px-wide container on cx
        top:  cy - CHIP_ABOVE - 10,   // circle top
        width: 72,               // wide enough for name ellipsis
        background: 'none', border: 'none', padding: 0,
        cursor: player.eligibleForVoting ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        // No height limit — content defines the height
      }}
    >
      {/* Circle */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: hasVoted ? (primaryColor ?? 'rgba(26,26,34,0.92)') : 'rgba(38,38,46,0.92)',
        border: hasVoted ? `2.5px solid ${secondaryColor ?? 'rgba(255,255,255,0.22)'}` : '2.5px solid rgba(255,255,255,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 25, fontWeight: 1, fontFamily: 'T90Numbers, sans-serif', 
        color: hasVoted ? (secondaryColor ?? C.text) : 'rgba(255,255,255,0.45)',
        position: 'relative', flexShrink: 0,
        backdropFilter: 'blur(4px)',
        boxShadow: hasVoted ? `0 0 0 1.5px ${primaryColor ?? '#000'}` : '0 0 0 1.5px rgba(255,255,255,0.08)',
      }}>
        <span style={{ lineHeight: 1 }}>
{player.number}
  {player.goals > 0 && (
    <span style={{
      position: 'absolute',
      left: -12,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 20,
      height: 20,
      backgroundImage: 'url(/logos/objects/tango_ball.svg)',
      backgroundSize: '20px 20px',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))',
      pointerEvents: 'none',
    }} />
  )}
  
  {wasRedCarded && (
    <span style={{
      position: 'absolute',
      right: -10,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 16,
      height: 20,
      backgroundImage: 'url(/logos/objects/red_card.svg)',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))',
      pointerEvents: 'none',
    }} />
  )}  
</span>
        
      </div>

      {/* FIX 2: Name — always rendered, below the circle */}
<span style={{
  marginTop: 6,
  fontSize: 10,
  fontWeight: 600,
  color: C.text,
  textAlign: 'center',
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)',
  lineHeight: '12px',
  display: 'block',
}}>
  {formatPlayerShortName(player.name)}
</span>


            {/* My vote — primary */}
<div style={{
  marginTop: 4,
  height: 22,
  minWidth: 32,
  background: myVote !== null ? ratingBg(myVote) : 'rgba(37,37,46,0.85)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 6px',
  boxShadow: myVote === 10
  ? '0 0 10px rgba(212,175,55,0.75), 0 0 18px rgba(212,175,55,0.45)'
  : 'none',
}}>
  <span style={{
    fontSize: 12,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
  }}>
    {typeof window !== 'undefined' && myVote !== null
      ? String(myVote)
      : (player.eligibleForVoting ? '–' : '')
    }
  </span>
</div>

{/* Average — secondary */}
<div style={{
  marginTop: 4,
  minHeight: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <span style={{
    fontSize: 10,
    fontWeight: 600,
    color: showAvg ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)',
    lineHeight: 1,
    textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)',
  }}>
    {typeof window !== 'undefined' && showAvg
      ? ratingLabel(serverAvg!)
      : ''
    }
  </span>
</div>
    </button>
  )
}

// ── Coach Row ─────────────────────────────────────────────────────────────
function CoachRow({ matchId, coach, changes, subsLimit, avgData, phase, onOpen }: {
  matchId: string; coach: {id:string; name:string}; changes: number; subsLimit: number
  avgData: EntityAverage | undefined
  phase: ReturnType<typeof getMatchPhase>['phase']
  onOpen: (t: VotingTarget) => void
}) {
  const entityId = `${matchId}_${coach.id}`
  const [localVote, setLocalVote] = useState<number | null>(() => readVote(entityId))
  useEffect(() => {
    const refresh = () => setLocalVote(readVote(entityId))
    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [entityId])
  const myVote       = avgData?.myVote ?? localVote
  const displayScore = getDisplayScore(phase, myVote, avgData?.avg ?? null)

  return (
    <button onClick={() => onOpen({
        entityId:   entityId,
        matchId:    matchId,
        targetId:   coach.id,
        targetType: 'coach',
        name:       coach.name,
        position:   'DT',
        eligible:   true,
      })}
      style={{ width: '100%', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.045)', borderRadius: 8, padding: '0 13px', height: 44, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left', transition: 'background 120ms' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {coach.name}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: changes > 0 ? C.accent : C.text3,
            opacity: 0.75,
          }}>
            ⇄ {changes}/{subsLimit}
          </span>
        </div>
      </div>
      <RowScoreDisplay myVote={myVote} serverAvg={avgData?.avg ?? null} phase={phase} eligible />
    </button>
  )
}

// ── Subs List ─────────────────────────────────────────────────────────────
function SubsList({ players, matchId, primaryColor, secondaryColor, avgsMap, phase, onOpen }: {
  players: ProcessedPlayer[]; matchId: string
  primaryColor?: string; secondaryColor?: string
  avgsMap: Record<string, EntityAverage>
  phase: ReturnType<typeof getMatchPhase>['phase']
  onOpen: (t: VotingTarget) => void
}) {
  const subs = players
    .filter(p => !p.starter && p.minuteIn !== null)
    .sort((a, b) => (a.minuteIn ?? 999) - (b.minuteIn ?? 999))
  if (!subs.length) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.text3, marginBottom: 8, paddingLeft: 4 }}>SUPLENTES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {subs.map(p => (
  <SubRow
    key={p.id}
    player={p}
    matchId={matchId}
    primaryColor={primaryColor}
    secondaryColor={secondaryColor}
    avgData={avgsMap[p.id]}
    phase={phase}
    onOpen={onOpen}
  />
))}
      </div>
    </div>
  )
}

function SubRow({ player, matchId, primaryColor, secondaryColor, avgData, phase, onOpen }: {
  player: ProcessedPlayer; matchId: string
  primaryColor?: string; secondaryColor?: string
  avgData: EntityAverage | undefined
  phase: ReturnType<typeof getMatchPhase>['phase']
  onOpen: (t: VotingTarget) => void
}) {
  const entityId = `${matchId}_${player.id}`
  const [localVote, setLocalVote] = useState<number | null>(() => readVote(entityId))
  useEffect(() => {
    const refresh = () => setLocalVote(readVote(entityId))
    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [entityId])
  const myVote       = avgData?.myVote ?? localVote
  const displayScore = getDisplayScore(phase, myVote, avgData?.avg ?? null)

  return (
    <button onClick={() => {
        if (!player.eligibleForVoting) return
        onOpen({
          entityId,
          matchId,
          targetId:   player.id,
          targetType: 'player',
          name:       player.name,
          number:     player.number,
          position:   player.position,
          minutesPlayed: player.derivedMinutesPlayed,
          eligible:   player.eligibleForVoting,
        })
      }}
      style={{ width: '100%', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.045)', borderRadius: 8, padding: '0 13px', height: 44 , display: 'flex', alignItems: 'center', gap: 9, cursor: player.eligibleForVoting ? 'pointer' : 'default', textAlign: 'left', transition: 'background 120ms' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: myVote !== null ? (primaryColor ?? 'rgba(26,26,34,0.92)') : 'rgba(38,38,46,0.92)',
        border: myVote !== null ? `2.5px solid ${secondaryColor ?? 'rgba(255,255,255,0.22)'}` : '2.5px solid rgba(255,255,255,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 25, fontWeight: 1, fontFamily: 'T90Numbers, sans-serif',
        color: myVote !== null ? (secondaryColor ?? C.text) : 'rgba(255,255,255,0.45)',
        position: 'relative', flexShrink: 0,
        backdropFilter: 'blur(4px)',
        boxShadow: myVote !== null ? `0 0 0 1.5px ${primaryColor ?? '#000'}` : '0 0 0 1.5px rgba(255,255,255,0.08)',
      }}>
        {player.number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{player.name}</span>
        <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>↑ {player.minuteInDisplay ?? `${player.minuteIn}'`}</span>
      </div>
      {player.goals > 0 && <span style={{ fontSize: 11, color: C.text2 }}>{player.goals > 1 ? `⚽ ×${player.goals}` : '⚽'}</span>}
      <RowScoreDisplay myVote={myVote} serverAvg={avgData?.avg ?? null} phase={phase} eligible={player.eligibleForVoting} />
    </button>
  )
}

// ── FIX 7: Referee Row — always shown, not gated by activeTeam ────────────
function RefereeRow({ matchId, referee, avgData, phase, onOpen }: {
  matchId: string; referee: {id:string; name:string}
  avgData: EntityAverage | undefined
  phase: ReturnType<typeof getMatchPhase>['phase']
  onOpen: (t: VotingTarget) => void
}) {
  const entityId = `${matchId}_${referee.id}`
  const [localVote, setLocalVote] = useState<number | null>(() => readVote(entityId))
  useEffect(() => {
    const refresh = () => setLocalVote(readVote(entityId))
    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [entityId])
  const myVote       = avgData?.myVote ?? localVote
  const displayScore = getDisplayScore(phase, myVote, avgData?.avg ?? null)

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.text3, marginBottom: 8, paddingLeft: 4 }}>ÁRBITRO PRINCIPAL</div>
      <button onClick={() => onOpen({
          entityId,
          matchId,
          targetId:   referee.id,
          targetType: 'referee',
          name:       referee.name,
          position:   'Árbitro principal',
          eligible:   true,
        })}
        style={{ width: '100%', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.045)', borderRadius: 8, padding: '0 13px', height: 44, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left', transition: 'background 120ms' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{referee.name}</div>
        </div>
        <RowScoreDisplay myVote={myVote} serverAvg={avgData?.avg ?? null} phase={phase} eligible cta />
      </button>
    </div>
  )
}

// ── Row score display (DT / suplentes / árbitro) ─────────────────────────
// Muestra: voto propio (pill con color) + promedio global (texto secundario).
// Mismo modelo visual que PlayerChip, adaptado a layout de fila horizontal.
function RowScoreDisplay({ myVote, serverAvg: rawServerAvg, phase, eligible, cta }: {
  myVote:    number | null
  serverAvg: number | null
  phase:     ReturnType<typeof getMatchPhase>['phase']
  eligible:  boolean
  cta?:      boolean
}) {
    const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div style={{ width: 36, height: 36, flexShrink: 0 }} />
  }

  // Si el servidor aún no devolvió avg pero el usuario ya votó,
  // usamos myVote como fallback (avg de 1 solo voto = ese voto).
  const serverAvg = rawServerAvg
  // En modo ciego: avg visible solo si el usuario ya votó esa entidad
  const showAvg =
  phase === 'voting_open_blind'
    ? myVote !== null && serverAvg !== null
    : serverAvg !== null

  const hasVoted = myVote !== null

  if (!hasVoted && !showAvg) {
        if (!eligible) return <div style={{ width: 36, height: 36, flexShrink: 0 }} />
    return (
      <div style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${cta ? C.accent : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: C.accent, fontWeight: 700 }}>VOTÁ</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {showAvg && (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>
          {ratingLabel(serverAvg!)}
        </span>
      )}

      {hasVoted ? (
        <div style={{ minWidth: 30, height: 22, borderRadius: 7, background: ratingBg(myVote!), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{String(myVote!)}</span>
        </div>
      ) : eligible ? (
        <div style={{ minWidth: 30, height: 22, borderRadius: 7, background: C.s2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text2, lineHeight: 1 }}>-</span>
        </div>
      ) : null}
    </div>
  )
}

// ── Shared score badge ────────────────────────────────────────────────────
function ScoreBadge({ score, eligible, cta }: { score: number | null; eligible: boolean; cta?: boolean }) {
  if (score !== null) {
    return (
      <div style={{ width: 36, height: 36, borderRadius: 10, background: ratingBg(score), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{ratingLabel(score)}</span>
      </div>
    )
  }
  if (!eligible) return null
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${cta ? C.accent : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 9, color: C.accent, fontWeight: 700 }}>VOTÁ</span>
    </div>
  )
}

// ── FIX 8: Voting Bottom Sheet — centred on desktop, Supabase-backed ────────
// ── Voting Bottom Sheet — centred on desktop, Supabase-backed ────────────
// ── Voting Bottom Sheet — centred on desktop, Supabase-backed ────────────
const RATINGS = [1,2,3,4,5,6,7,8,9,10]
const RATING_DESCRIPTIONS: Record<number, string> = {
  1: 'Desastre!',
  2: 'Horrible',
  3: 'Muy mal',
  4: 'Flojo',
  5: 'Intrascendente',
  6: 'Cumplió',
  7: 'Correcto',
  8: 'Buen partido',
  9: 'Muy buen partido',
  10: 'Figura!',
}
const SHEET_MAX_W = 480

function VotingSheet({ target, onClose, onVoteSaved, phase }: {
  target: VotingTarget | null
  onClose: () => void
  onVoteSaved: (newPlaques: PlaqueMeta[]) => void
  phase: ReturnType<typeof getMatchPhase>['phase']
}) {
  const [myVote,  setMyVote]  = useState<number | null>(null)
  const [avg,     setAvg]     = useState<number | null>(null)
  const [count,   setCount]   = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const savedScrollY = useRef<number>(0)
  const isOpen = target !== null
  const previewRating = hovered ?? myVote

  useEffect(() => {
    // Resetear todo antes de cargar — evita arrastre entre entidades
    setMyVote(null)
    setAvg(null)
    setCount(0)
    setLoading(false)
    setSaving(false)
    setHovered(null)

    if (!target) return

    const anonId = getAnonId()

    // Restaurar myVote desde localStorage de inmediato (feedback instantáneo)
    // No usamos localStorage para avg/count porque puede estar corrupto
    const localVote = readVote(target.entityId)
    if (localVote !== null) setMyVote(localVote)

    // Cargar summary real desde Supabase
    setLoading(true)
    const qs = new URLSearchParams({
      match_id:    target.matchId,
      target_type: target.targetType,
      target_id:   target.targetId,
      anon_id:     anonId,
    })
    fetch(`/api/votes/summary?${qs}`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: { avg: number | null; count: number; myVote: number | null }) => {
        // BUG FIX: solo setear si es un número real.
        // "data.avg !== undefined" permite que null sobreescriba valores válidos.
        if (typeof data.avg === 'number')             setAvg(data.avg)
        if (typeof data.count === 'number' && data.count > 0) setCount(data.count)
        if (data.myVote != null) {
          setMyVote(data.myVote)
          // BUG FIX: usar cacheMyVote, no saveVote.
          // saveVote incrementa el contador local en cada llamada,
          // corrompiendo tango90_ratings con cada apertura del modal.
          cacheMyVote(target.entityId, data.myVote)
        }
      })
      .catch(err => console.error('[VotingSheet] summary fetch error:', err))
      .finally(() => setLoading(false))
  }, [target?.entityId])

  // Bloquear scroll del body, preservando posición exacta al cerrar.
  // Usamos un ref para guardar la posición — evita el bug donde el cleanup
  // limpia body.style.top antes de que el else-branch pueda leerlo.
  useEffect(() => {
    if (isOpen) {
      savedScrollY.current = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top      = `-${savedScrollY.current}px`
      document.body.style.width    = '100%'
    } else {
      const y = savedScrollY.current
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top      = ''
      document.body.style.width    = ''
      window.scrollTo(0, y)
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top      = ''
      document.body.style.width    = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  const handleVote = async (val: number) => {
    if (!target || myVote !== null || saving) return

    // Update optimista
    setMyVote(val)
    setSaving(true)

    // Guardar en localStorage y actualizar chips en cancha
    const cached = saveVote(target.entityId, val)
    setAvg(cached.sum / cached.count)
    setCount(cached.count)

    let newPlaques: PlaqueMeta[] = []

    try {
      const res = await fetch('/api/votes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id:    target.matchId,
          target_type: target.targetType,
          target_id:   target.targetId,
          score:       val,
          anon_id:     getAnonId(),
        }),
      })

      if (res.ok) {
        try {
          const data = await res.json()
          if (data.newPlaques?.length > 0) newPlaques = data.newPlaques
        } catch {}
      }

      // Re-fetch summary para mostrar datos reales del servidor
      if (res.ok || res.status === 409) {
        const qs = new URLSearchParams({
          match_id:    target.matchId,
          target_type: target.targetType,
          target_id:   target.targetId,
          anon_id:     getAnonId(),
        })
        const s = await fetch(`/api/votes/summary?${qs}`, { cache: 'no-store' })
        if (s.ok) {
          const data = await s.json()
          if (typeof data.avg   === 'number')              setAvg(data.avg)
          if (typeof data.count === 'number' && data.count > 0) setCount(data.count)
        }
      }
    } catch {
      // Error de red — localStorage ya actualizado, degradación elegante
    } finally {
      setSaving(false)
      onVoteSaved(newPlaques)
    }
  }

  const hasVoted = myVote !== null
  // En modo ciego, ocultar avg/count hasta que el usuario vote.
  // Una vez que votó, se muestran siempre (el voto está emitido, ya no hay anchoring).
  const isBlind    = phase === 'voting_open_blind' && !hasVoted
  const displayAvg = isBlind ? null : (avg ?? (hasVoted ? myVote : null))
  const displayCount = isBlind ? 0 : (count > 0 ? count : (hasVoted ? 1 : 0))


  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'all' : 'none',
        transition: 'opacity 260ms ease',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        display: 'flex', justifyContent: 'center',
        transform: isOpen ? 'translateY(0)' : 'translateY(105%)',
        transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
      }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: SHEET_MAX_W,
            background: C.s1,
            borderRadius: '24px 24px 0 0',
            border: `1px solid ${C.border}`, borderBottom: 'none',
            padding: '0 20px 40px',
            maxHeight: '82vh', overflowY: 'auto',
            boxShadow: '0 -16px 48px rgba(0,0,0,0.5)',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.s3 }} />
          </div>

          {target && (
            <>
              {/* Info del jugador */}
              <div style={{ marginBottom: 20, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {target.number !== undefined && (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.s2, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.text, flexShrink: 0 }}>
                      {target.number}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>{target.name}</div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>
                      {target.position}{target.minutesPlayed !== undefined ? ` · ${Math.round(target.minutesPlayed)}'` : ''}
                    </div>
                  </div>
                  {loading && !hasVoted && (
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  )}
                </div>
              </div>

              {/* Preview de voto / número grande */}
              {previewRating !== null && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <span style={{
                    fontSize: hasVoted ? 80 : 64,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: ratingBg(previewRating),
                    letterSpacing: '-0.04em',
                    display: 'block',
                  }}>
                    {previewRating}
                  </span>

                  <div style={{
                    marginTop: 6,
                    fontSize: 14,
                    fontWeight: 800,
                    color: ratingBg(previewRating),
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}>
                    {RATING_DESCRIPTIONS[previewRating]}
                  </div>
                </div>
              )}

              {/* Botones de rating 1-10 */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
                {RATINGS.map(n => {
                  const isSelected = myVote === n
                  const isDimmed   = hasVoted && !isSelected
                  const isHov      = hovered === n && !hasVoted
                  return (
                    <button key={n}
                      onClick={() => handleVote(n)}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(n)}
                      onBlur={() => setHovered(null)}
                      disabled={hasVoted || saving}
                      style={{
                        flex: 1, minWidth: 0, height: 48, borderRadius: 10,
                        border: isSelected ? `2px solid ${ratingBg(n)}` : isHov ? `1px solid ${ratingBg(n)}` : `1px solid ${C.border}`,
                        background: isSelected ? `${ratingBg(n)}22` : isHov ? `${ratingBg(n)}11` : C.s2,
                        color: ratingBg(n), fontSize: 15, fontWeight: 800,
                        cursor: (hasVoted || saving) ? 'default' : 'pointer',
                        opacity: isDimmed ? 0.18 : 1,
                        transition: 'all 100ms ease', padding: 0,
                      }}
                    >{n}</button>
                  )
                })}
              </div>

              {!hasVoted && phase === 'voting_open_blind' && (
                <div style={{
                  background: 'rgba(108,206,255,0.06)', border: `1px solid ${C.accentBorder}`,
                  borderRadius: 10, padding: '8px 12px', marginBottom: 14,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 14 }}>👁️</span>
                  <p style={{ margin: 0, fontSize: 11, color: C.accent, fontWeight: 600 }}>
                    Modo ciego — los promedios se revelan luego de calificar
                  </p>
                </div>
              )}
              {!hasVoted && phase !== 'voting_open_blind' && (
                <p style={{ textAlign: 'center', fontSize: 12, color: C.text3, margin: '0 0 16px', fontWeight: 500 }}>
                  Tocá un número para calificar
                </p>
              )}

              {/* Panel de feedback — siempre visible cuando se votó */}
              {hasVoted && (
                <div style={{ background: C.s2, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FeedbackRow label="TU NOTA"  value={String(myVote)}                                   color={ratingBg(myVote!)} />
                  <FeedbackRow label="PROMEDIO" value={ratingLabel(displayAvg!)}  color={ratingBg(displayAvg!)} />
                  <FeedbackRow label="VOTOS"    value={String(displayCount)} />
                </div>
              )}

              <button onClick={onClose} style={{ width: '100%', marginTop: 16, height: 48, background: C.s2, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text2, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
function FeedbackRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: color ?? C.text, letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  )
}

// ── Barra de progreso de votación ─────────────────────────────────────────
function ProgressBar({ voted, total, phase }: {
  voted: number; total: number; phase: ReturnType<typeof getMatchPhase>['phase']
}) {
  const pct = total > 0 ? Math.round((voted / total) * 100) : 0
  const label = voted >= total
    ? '¡Calificaste todo!'
    : phase === 'voting_open_blind'
      ? `${voted}/${total} · modo ciego activo`
      : `${voted}/${total} calificados`

  return (
  <div style={{
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150,
    background: 'rgba(11,11,15,0.92)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    padding: '7px 16px 10px',
    backdropFilter: 'blur(12px)',
  }}>
    <div style={{
      maxWidth: 680,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '1fr 36px',
      alignItems: 'end',
      gap: 12,
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.36)', fontWeight: 600, letterSpacing: '0.10em' }}>
            CALIFICACIONES
          </span>
          <span style={{ fontSize: 9, color: pct === 100 ? 'rgba(63,165,106,0.95)' : 'rgba(255,255,255,0.46)', fontWeight: 600 }}>
            {label}
          </span>
        </div>

        <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: pct === 100 ? 'rgba(63,165,106,0.95)' : 'rgba(251,208,5,0.82)',
            borderRadius: 2,
            transition: 'width 400ms ease',
          }} />
        </div>
      </div>

      <button
        aria-label="Compartir placa"
        disabled={pct < 100}
        style={{
          width: 36,
          height: 28,
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          background: pct === 100 ? 'rgba(251,208,5,0.12)' : 'rgba(255,255,255,0.03)',
          color: pct === 100 ? '#FBD005' : 'rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: pct === 100 ? 'pointer' : 'default',
          opacity: pct === 100 ? 1 : 0.55,
        }}
      >
        ↗
      </button>
    </div>
  </div>
)
}

// ── Banner de votación cerrada ────────────────────────────────────────────
function ClosedBanner() {
  return (
  <div style={{
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: '10px 14px',
    margin: '0 16px 16px',
    maxWidth: 680 - 32,
    marginLeft: 'auto',
    marginRight: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  }}>
    <span style={{
      fontSize: 14,
      opacity: 0.45,
      filter: 'grayscale(1)',
    }}>
      🔒
    </span>

    <div>
      <p style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 700,
        color: C.text2,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Votación cerrada
      </p>

      <p style={{
        margin: '2px 0 0',
        fontSize: 11,
        color: C.text3,
      }}>
        La ventana de 24 horas finalizó
      </p>
    </div>
  </div>
)
}

// ── Toast de placas desbloqueadas ─────────────────────────────────────────
function PlaquesToast({ plaques, onDismiss }: {
  plaques: PlaqueMeta[]
  onDismiss: () => void
}) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex', flexDirection: 'column', gap: 8,
        minWidth: 260, maxWidth: 340,
      }}
    >
      {plaques.map((p, i) => (
        <div key={i} style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: `1px solid ${p.type === 'match' ? '#6CCEFF' : 'rgba(108,206,255,0.4)'}`,
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slideDown 300ms ease',
        }}>
          <span style={{ fontSize: 28 }}>{p.type === 'match' ? '🏆' : '⭐'}</span>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.1em' }}>
              {p.type === 'match' ? 'PLACA DE PARTIDO' : 'PLACA DE EQUIPO'}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>
              {p.type === 'match' ? '¡Calificaste todo!' : `${p.teamName ?? 'Equipo'} completo`}
            </p>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
