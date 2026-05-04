import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 48, color: '#F5A623', margin: 0 }}>404</h1>
      <p style={{ color: '#555', marginTop: 8 }}>Partido no encontrado</p>
      <Link href="/" style={{ color: '#F5A623', textDecoration: 'none', fontFamily: 'Oswald, sans-serif' }}>
        ← Volver al inicio
      </Link>
    </div>
  )
}
