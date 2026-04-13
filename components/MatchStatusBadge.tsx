'use client'

import { useEffect, useState } from 'react'

type Props = {
  // IDs de todas las entidades votables del partido
  entityIds: string[]
  // Si el partido no es 'finished', no renderiza nada
  isFinished: boolean
}

type VoteState = 'none' | 'partial' | 'complete'

export default function MatchStatusBadge({ entityIds, isFinished }: Props) {
  const [state, setState] = useState<VoteState>('none')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isFinished || entityIds.length === 0) return

    try {
      const raw = localStorage.getItem('tango90_myvotes')
      const myVotes: Record<string, number> = raw ? JSON.parse(raw) : {}
      const votedCount = entityIds.filter(id => myVotes[id] !== undefined).length

      if (votedCount === 0) setState('none')
      else if (votedCount === entityIds.length) setState('complete')
      else setState('partial')
    } catch {
      setState('none')
    }
  }, [entityIds, isFinished])

  // Server render: muestra el badge estático, sin leer localStorage
  if (!mounted || !isFinished) {
    return isFinished ? <DefaultBadge /> : null
  }

  if (state === 'complete') {
    return (
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700,
        padding: '2px 7px', borderRadius: 3, letterSpacing: '0.07em',
        background: 'rgba(34,197,94,0.12)', color: '#22c55e',
        border: '1px solid rgba(34,197,94,0.3)',
      }}>
        VER CALIFICACIÓN
      </span>
    )
  }

  if (state === 'partial') {
    return (
      <span style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700,
        padding: '2px 7px', borderRadius: 3, letterSpacing: '0.07em',
        background: 'rgba(245,166,35,0.12)', color: '#F5A623',
        border: '1px solid rgba(245,166,35,0.3)',
      }}>
        EN PROCESO
      </span>
    )
  }

  return <DefaultBadge />
}

function DefaultBadge() {
  return (
    <span style={{
      fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700,
      padding: '2px 7px', borderRadius: 3, letterSpacing: '0.07em',
      background: '#1a1a1a', color: '#F5A623',
    }}>
      CALIFICÁ
    </span>
  )
}
