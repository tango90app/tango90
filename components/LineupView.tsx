'use client'

import { useState, useEffect, useCallback } from 'react'
import { type Position } from '@/data/matches'
import { type ProcessedPlayer } from '@/lib/processMatch'
import { getScoreColor } from '@/lib/scoreColor'
import { modalBus } from '@/lib/modalBus'
import RatingModal from './RatingModal'

type Props = {
  matchId: string
  players: ProcessedPlayer[]   // ahora recibe jugadores procesados
  teamName: string
  isHome: boolean
}

type Line = 'ARQ' | 'DEF' | 'MED' | 'DEL'

function getLine(pos: Position): Line {
  if (pos === 'ARQ') return 'ARQ'
  if (pos === 'LAD' || pos === 'DFC' || pos === 'LAI') return 'DEF'
  if (pos === 'MC') return 'MED'
  return 'DEL'
}

const LINE_LABELS: Record<Line, string> = {
  ARQ: 'ARQUERO',
  DEF: 'DEFENSA',
  MED: 'MEDIOCAMPO',
  DEL: 'DELANTERA',
}


function lastName(fullName: string): string {
  const parts = fullName.trim().split(' ')
  return parts.length === 1 ? parts[0] : parts.slice(-1).join(' ')
}

function readMyVote(entityId: string): number | null {
  try {
    const votes = JSON.parse(localStorage.getItem('tango90_myvotes') || '{}')
    return votes[entityId] ?? null
  } catch { return null }
}

function readAvg(entityId: string): number | null {
  try {
    const ratings = JSON.parse(localStorage.getItem('tango90_ratings') || '{}')
    const s = ratings[entityId]
    return s && s.count > 0 ? s.sum / s.count : null
  } catch { return null }
}

// ── Componente principal ───────────────────────────────────────────────────

export default function LineupView({ matchId, players, isHome }: Props) {
  const starters = players.filter(p => p.starter)
  // Suplentes que efectivamente ingresaron — usar status derivado
  const subs = players.filter(p => !p.starter && p.minuteIn !== null)

  const byLine: Record<Line, ProcessedPlayer[]> = { ARQ: [], DEF: [], MED: [], DEL: [] }
  for (const p of starters) byLine[getLine(p.position)].push(p)

  // Local: ARQ arriba → ataca hacia abajo (DEL al fondo)
  // Visitante: DEL arriba → ataca hacia arriba (ARQ al fondo)
  const lineOrder: Line[] = isHome
    ? ['ARQ', 'DEF', 'MED', 'DEL']
    : ['DEL', 'MED', 'DEF', 'ARQ']

  const [selectedPlayer, setSelectedPlayer] = useState<ProcessedPlayer | null>(null)

  // Registrar en el bus para que otros modales puedan cerrar este
  useEffect(() => {
    const unregister = modalBus.register(() => setSelectedPlayer(null))
    return unregister
  }, [])

  const openModal = useCallback((player: ProcessedPlayer) => {
    modalBus.closeAll()
    setSelectedPlayer(player)
  }, [])

  const closeModal = useCallback(() => setSelectedPlayer(null), [])

  // Evento para que las tarjetas se actualicen después de un voto
  const handleVoted = useCallback(() => {
    window.dispatchEvent(new CustomEvent('tango90:vote-saved'))
  }, [])

  const modalEntityId = selectedPlayer ? `${matchId}_${selectedPlayer.id}` : ''

  return (
    <div>
      {/* Mini cancha — titulares */}
      <div style={{
        background: '#0f1a0f',
        border: '1px solid #1a2e1a',
        borderRadius: 6,
        padding: '12px 8px',
        marginBottom: 6,
      }}>
        {lineOrder.map(line => {
          const linePlayers = byLine[line]
          if (linePlayers.length === 0) return null
          return (
            <div key={line} style={{ marginBottom: 10 }}>
              <div style={{
                textAlign: 'center',
                fontFamily: 'Oswald, sans-serif', fontSize: 9,
                color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em',
                marginBottom: 6,
              }}>
                {LINE_LABELS[line]}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                {linePlayers.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    matchId={matchId}
                    onOpen={() => openModal(p)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Suplentes */}
      {subs.length > 0 && (
        <div style={{
          background: '#141414',
          border: '1px solid #1f1f1f',
          borderRadius: 6,
          padding: '0 14px',
          marginBottom: 6,
        }}>
          <div style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 10, color: '#555',
            letterSpacing: '0.1em', padding: '8px 0 4px',
          }}>
            SUPLENTES QUE INGRESARON
          </div>
          {subs.map(p => (
            <SubRow
              key={p.id}
              player={p}
              matchId={matchId}
              onOpen={() => openModal(p)}
            />
          ))}
        </div>
      )}

      {/* Modal único del equipo */}
      {selectedPlayer && (
        <RatingModal
          isOpen={true}
          onClose={closeModal}
          entityId={modalEntityId}
          name={selectedPlayer.name}
          position={selectedPlayer.position}
          minutesPlayed={selectedPlayer.derivedMinutesPlayed}
          onVoted={handleVoted}
        />
      )}
    </div>
  )
}

// ── Tarjeta de titular en la mini cancha ──────────────────────────────────

function PlayerCard({ player, matchId, onOpen }: { player: ProcessedPlayer; matchId: string; onOpen: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [myVote, setMyVote] = useState<number | null>(null)
  const [avg, setAvg] = useState<number | null>(null)

  const entityId = `${matchId}_${player.id}`

  // Distinguir causa de salida usando status — no son equivalentes
  const wasSubbedOut = player.status === 'starter_subbed_out' || player.status === 'sub_entered_subbed_out'
  const wasRedCarded  = player.status === 'starter_red_card'  || player.status === 'sub_entered_red_card'

  const refresh = useCallback(() => {
    setMyVote(readMyVote(entityId))
    setAvg(readAvg(entityId))
  }, [entityId])

  useEffect(() => {
    setMounted(true)
    refresh()
    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [refresh])

  const hasVoted = myVote !== null

  return (
    <button
      onClick={onOpen}
      style={{
        width: 66,
        background: hasVoted ? 'rgba(245,166,35,0.06)' : 'transparent',
        border: hasVoted ? '1px solid rgba(245,166,35,0.2)' : '1px solid transparent',
        borderRadius: 6,
        padding: '6px 4px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!hasVoted) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        }
      }}
      onMouseLeave={e => {
        if (!hasVoted) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
        }
      }}
    >
      {/* Círculo con número de camiseta */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: hasVoted ? 'rgba(245,166,35,0.12)' : '#1c1c1c',
        border: `1.5px solid ${hasVoted ? 'rgba(245,166,35,0.45)' : '#2a2a2a'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Oswald, sans-serif', fontSize: 12, fontWeight: 700,
        color: hasVoted ? '#F5A623' : '#777',
        position: 'relative', flexShrink: 0,
      }}>
        {player.number}

        {/* Salida por sustitución — flecha ↓ con minuto formateado */}
        {wasSubbedOut && (
          <span style={{
            position: 'absolute', bottom: -7, right: -5,
            fontSize: 9, color: '#ef4444', lineHeight: 1,
            fontFamily: 'Oswald, sans-serif', fontWeight: 700,
          }}>
            ↓{player.minuteOutDisplay ?? `${player.minuteOut}'`}
          </span>
        )}

        {/* Salida por expulsión — tarjeta roja con minuto formateado */}
        {wasRedCarded && (
          <span style={{
            position: 'absolute', bottom: -7, right: -6,
            fontSize: 9, lineHeight: 1,
          }}>
            🟥{player.minuteOutDisplay ?? `${player.minuteOut}'`}
          </span>
        )}
      </div>

      {/* Apellido */}
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 500,
        color: '#ccc', textAlign: 'center', lineHeight: 1.2,
        maxWidth: 62, wordBreak: 'break-word',
      }}>
        {lastName(player.name)}
      </span>

      {/* Goles — solo si anotó al menos uno */}
      {player.goals > 0 && (
        <span style={{ fontSize: 9, lineHeight: 1 }}>
          {'⚽'.repeat(Math.min(player.goals, 3))}{player.goals > 3 ? `×${player.goals}` : player.goals > 1 ? `×${player.goals}` : ''}
        </span>
      )}

      {/* Nota propia o promedio */}
      {mounted && (
        hasVoted ? (
          <span style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 700,
            color: getScoreColor(myVote!),
          }}>
            {myVote}
            {avg !== null && (
              <span style={{ fontSize: 9, color: '#555', fontWeight: 400, marginLeft: 2 }}>
                ({avg.toFixed(1)})
              </span>
            )}
          </span>
        ) : (
          <span style={{ fontSize: 9, color: '#3a3a3a' }}>
            {avg !== null ? avg.toFixed(1) : '·'}
          </span>
        )
      )}
    </button>
  )
}

// ── Fila de suplente ──────────────────────────────────────────────────────

function SubRow({ player, matchId, onOpen }: { player: ProcessedPlayer; matchId: string; onOpen: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [myVote, setMyVote] = useState<number | null>(null)
  const [avg, setAvg] = useState<number | null>(null)

  const entityId = `${matchId}_${player.id}`

  const refresh = useCallback(() => {
    setMyVote(readMyVote(entityId))
    setAvg(readAvg(entityId))
  }, [entityId])

  useEffect(() => {
    setMounted(true)
    refresh()
    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [refresh])

  const hasVoted = myVote !== null
  // Usar minuteIn derivado — ya no calculamos 90 - minutesPlayed
  const minuteIn = player.minuteIn ?? 0

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid #1e1e1e',
        padding: '10px 0',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 12, color: '#444',
        minWidth: 20, textAlign: 'right', flexShrink: 0,
      }}>
        {player.number}
      </span>
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 600,
        background: '#1a1a1a', border: '1px solid #252525',
        color: '#555', padding: '1px 5px', borderRadius: 3,
        letterSpacing: '0.05em', flexShrink: 0,
      }}>
        {player.position}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 500, color: '#e0e0e0' }}>
          {player.name}
        </span>
        <span style={{ fontSize: 11, color: '#555', marginLeft: 6 }}>
          ↑ {player.minuteInDisplay ?? `${player.minuteIn}'`}
        </span>
      </div>
      {mounted && (
        hasVoted ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
            <span style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 700,
              color: getScoreColor(myVote!), lineHeight: 1,
            }}>
              {myVote}
            </span>
            {avg !== null && (
              <span style={{ fontSize: 10, color: '#555' }}>prom {avg.toFixed(1)}</span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {avg !== null && (
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, color: '#444' }}>
                {avg.toFixed(1)}
              </span>
            )}
            <span style={{ fontSize: 10, color: '#333', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.05em' }}>
              VOTÁ
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" strokeWidth="2" strokeLinecap="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        )
      )}
    </button>
  )
}
