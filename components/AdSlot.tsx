type AdSlotProps = {
  type?: 'banner' | 'large'
  label?: string
}

export default function AdSlot({ type = 'banner', label = 'PUBLICIDAD' }: AdSlotProps) {
  const isLarge = type === 'large'

  return (
    <div
      style={{
        width: '100%',
        height: isLarge ? 250 : 50,
        borderRadius: isLarge ? 14 : 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.035)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.28)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        margin: isLarge ? '20px 0' : '12px 0',
      }}
    >
      {label}
    </div>
  )
}