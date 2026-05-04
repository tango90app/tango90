'use client'

import { useState, useEffect, useCallback } from 'react'
import { getScoreColor } from '@/lib/scoreColor'
import { modalBus } from '@/lib/modalBus'
import RatingModal from './RatingModal'

type Props = {
  entityId: string
  label: string
  sublabel?: string
  position?: string
  number?: number
}

function readMyVote(entityId: string): number | null {
  try {
    const votes = JSON.parse(localStorage.getItem('tango90_myvotes') || '{}')
    return votes[entityId] ?? null
  } catch { return null }
}

function readStats(entityId: string): { sum: number; count: number } | null {
  try {
    const ratings = JSON.parse(localStorage.getItem('tango90_ratings') || '{}')
    return ratings[entityId] ?? null
  } catch { return null }
}

export default function RatingRow({ entityId, label, sublabel, position, number }: Props) {
  const [mounted, setMounted] = useState(false)
  const [myVote, setMyVote] = useState<number | null>(null)
  const [stats, setStats] = useState<{ sum: number; count: number } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const refresh = useCallback(() => {
    setMyVote(readMyVote(entityId))
    setStats(readStats(entityId))
  }, [entityId])

  useEffect(() => {
    setMounted(true)
    refresh()
    // Escuchar votos emitidos desde el modal
    window.addEventListener('tango90:vote-saved', refresh)
    return () => window.removeEventListener('tango90:vote-saved', refresh)
  }, [refresh])

  // Registrar en el bus para poder ser cerrado por otros modales
  useEffect(() => {
    const unregister = modalBus.register(() => setModalOpen(false))
    return unregister
  }, [])

  const openModal = () => {
    modalBus.closeAll()
    setModalOpen(true)
  }

  const handleVoted = useCallback((value: number) => {
    refresh()
    window.dispatchEvent(new CustomEvent('tango90:vote-saved'))
  }, [refresh])

  const avg = stats && stats.count > 0 ? stats.sum / stats.count : null
  const hasVoted = myVote !== null

  return (
    <>
      <button
        onClick={openModal}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #1e1e1e',
          padding: '11px 0',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          textAlign: 'left',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {/* Número (para suplentes con número de camiseta) */}
        {number !== undefined && (
          <span style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 12, color: '#444',
            minWidth: 22, textAlign: 'right', flexShrink: 0,
          }}>
            {number}
          </span>
        )}

        {/* Badge de posición */}
        {position && (
          <span style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 600,
            background: '#1f1f1f', border: '1px solid #2a2a2a',
            color: '#666', padding: '1px 5px', borderRadius: 3,
            letterSpacing: '0.05em', flexShrink: 0,
          }}>
            {position}
          </span>
        )}

        {/* Nombre y sublabel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 15, fontWeight: 500,
            color: '#e8e8e8',
          }}>
            {label}
          </span>
          {sublabel && (
            <span style={{ fontSize: 11, color: '#555', marginLeft: 6 }}>{sublabel}</span>
          )}
        </div>

        {/* Score o hint de votación */}
        {mounted && (
          hasVoted ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700,
                color: getScoreColor(myVote!), lineHeight: 1,
              }}>
                {myVote}
              </span>
              {avg !== null && stats && (
                <span style={{ fontSize: 10, color: '#555' }}>
                  prom {avg.toFixed(1)} · {stats.count} {stats.count === 1 ? 'voto' : 'votos'}
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {avg !== null && (
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, color: '#555' }}>
                  {avg.toFixed(1)}
                </span>
              )}
              <span style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 10,
                color: '#F5A623', letterSpacing: '0.06em',
                background: 'rgba(245,166,35,0.08)',
                border: '1px solid rgba(245,166,35,0.15)',
                padding: '2px 7px', borderRadius: 3,
              }}>
                VOTÁ
              </span>
            </div>
          )
        )}

        {/* Flecha derecha */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>

      {/* Modal propio de este row */}
      <RatingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        entityId={entityId}
        name={label}
        position={position}
        onVoted={handleVoted}
      />
    </>
  )
}
