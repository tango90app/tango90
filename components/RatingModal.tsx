'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getScoreColor } from '@/lib/scoreColor'

type Props = {
  isOpen: boolean
  onClose: () => void
  entityId: string
  name: string
  position?: string
  minutesPlayed?: number
  // Callback para que el padre actualice su estado de voto inmediatamente
  onVoted?: (value: number) => void
}

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function RatingModal({
  isOpen, onClose, entityId, name, position, minutesPlayed, onVoted
}: Props) {
  const [myVote, setMyVote] = useState<number | null>(null)
  const [stats, setStats] = useState<{ sum: number; count: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Mount guard para portal
  useEffect(() => { setMounted(true) }, [])

  // Cargar estado del voto cada vez que se abre (puede haber votado desde otro jugador)
  useEffect(() => {
    if (!isOpen || !mounted) return
    try {
      const myVotes = JSON.parse(localStorage.getItem('tango90_myvotes') || '{}')
      const allRatings = JSON.parse(localStorage.getItem('tango90_ratings') || '{}')
      setMyVote(myVotes[entityId] ?? null)
      setStats(allRatings[entityId] ?? null)
    } catch { /* noop */ }
  }, [isOpen, entityId, mounted])

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!mounted) return
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
    }
  }, [isOpen, mounted])

  // Tecla ESC
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleVote = useCallback((val: number) => {
    if (myVote !== null) return

    try {
      // Guardar mi voto
      const myVotes = JSON.parse(localStorage.getItem('tango90_myvotes') || '{}')
      myVotes[entityId] = val
      localStorage.setItem('tango90_myvotes', JSON.stringify(myVotes))

      // Actualizar stats globales
      const allRatings = JSON.parse(localStorage.getItem('tango90_ratings') || '{}')
      const prev = allRatings[entityId] || { sum: 0, count: 0 }
      allRatings[entityId] = { sum: prev.sum + val, count: prev.count + 1 }
      localStorage.setItem('tango90_ratings', JSON.stringify(allRatings))

      setMyVote(val)
      setStats(allRatings[entityId])
      onVoted?.(val)
    } catch { /* noop */ }
  }, [entityId, myVote, onVoted])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  if (!mounted || !isOpen) return null

  const avg = stats && stats.count > 0 ? stats.sum / stats.count : null
  const hasVoted = myVote !== null

  const modal = (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#181818',
          border: '1px solid #2a2a2a',
          borderRadius: 12,
          width: '100%', maxWidth: 380,
          padding: '20px',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: '#252525', border: '1px solid #333',
            color: '#888', cursor: 'pointer',
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, lineHeight: 1, flexShrink: 0,
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#333'
            e.currentTarget.style.color = '#ccc'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#252525'
            e.currentTarget.style.color = '#888'
          }}
        >
          ✕
        </button>

        {/* Info del jugador */}
        <div style={{ marginBottom: 20, paddingRight: 36 }}>
          {position && (
            <span style={{
              fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700,
              background: '#1f1f1f', border: '1px solid #2a2a2a',
              color: '#777', padding: '2px 7px', borderRadius: 3,
              letterSpacing: '0.08em', display: 'inline-block', marginBottom: 8,
            }}>
              {position}
            </span>
          )}
          <div style={{
            fontFamily: 'Oswald, sans-serif', fontSize: 22, fontWeight: 700,
            color: '#f0f0f0', lineHeight: 1.1,
          }}>
            {name}
          </div>
          {minutesPlayed !== undefined && (
            <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
              {minutesPlayed}' jugados
            </div>
          )}
        </div>

        {/* Número grande post-voto */}
        {hasVoted && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: 80, fontWeight: 700, lineHeight: 1,
              color: getScoreColor(myVote!),
            }}>
              {myVote}
            </span>
          </div>
        )}

        {/* Botones de calificación — flex:1 para que los 10 entren en una fila */}
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
        }}>
          {RATINGS.map(n => {
            const isSelected = myVote === n
            const dimmed = hasVoted && !isSelected
            return (
              <button
                key={n}
                onClick={() => handleVote(n)}
                disabled={hasVoted}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 46,
                  borderRadius: 6,
                  border: isSelected
                    ? `2px solid ${getScoreColor(n)}`
                    : '1px solid #2a2a2a',
                  background: isSelected
                    ? hexWithAlpha(getScoreColor(n), 0.18)
                    : '#141414',
                  color: getScoreColor(n),
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 15, fontWeight: 700,
                  cursor: hasVoted ? 'default' : 'pointer',
                  opacity: dimmed ? 0.22 : 1,
                  transition: 'background 0.1s, border-color 0.1s',
                  flexShrink: 0,
                  padding: 0,
                }}
                onMouseEnter={e => {
                  if (hasVoted) return
                  e.currentTarget.style.borderColor = getScoreColor(n)
                  e.currentTarget.style.background = hexWithAlpha(getScoreColor(n), 0.12)
                }}
                onMouseLeave={e => {
                  if (hasVoted || myVote === n) return
                  e.currentTarget.style.borderColor = '#2a2a2a'
                  e.currentTarget.style.background = '#141414'
                }}
              >
                {n}
              </button>
            )
          })}
        </div>

        {/* Hint si aún no votó */}
        {!hasVoted && (
          <div style={{
            textAlign: 'center', fontSize: 11, color: '#444',
            fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em',
          }}>
            TOCÁ UN NÚMERO PARA CALIFICAR
          </div>
        )}

        {/* Feedback post-voto */}
        {hasVoted && (
          <div style={{
            background: '#111', border: '1px solid #222',
            borderRadius: 8, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <FeedbackRow
              label="Tu nota"
              value={String(myVote)}
              color={getScoreColor(myVote!)}
            />
            {avg !== null && (
              <FeedbackRow
                label="Promedio"
                value={avg.toFixed(1)}
                color={getScoreColor(avg)}
              />
            )}
            {stats && (
              <FeedbackRow
                label="Total de votos"
                value={String(stats.count)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function FeedbackRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 11, color: '#555',
        letterSpacing: '0.08em',
      }}>
        {label.toUpperCase()}
      </span>
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 700,
        color: color || '#f0f0f0',
      }}>
        {value}
      </span>
    </div>
  )
}

// Convierte hex a rgba con alpha dado (para fondos de botones seleccionados)
function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
