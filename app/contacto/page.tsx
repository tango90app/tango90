export default function Page() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0B0B0F',
      color: 'white',
      padding: '48px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }}>
      <div>
        <h1 style={{
          fontSize: 20,
          fontWeight: 800,
          marginBottom: 12,
        }}>
          Página en construcción
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 14,
          lineHeight: 1.5,
          maxWidth: 420,
        }}>
          Estamos terminando esta sección de Tango90.
        </p>
      </div>
    </main>
  )
}