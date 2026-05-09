import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

const globalFooterLinkStyle = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: 11,
  fontWeight: 600,
  textDecoration: 'none',
  letterSpacing: '0.04em',
}

export const metadata: Metadata = {
  title: 'Tango90 | Calificá a los jugadores',
  description: 'La plataforma argentina para calificar jugadores, técnicos y árbitros',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      {/* 👇 SCRIPT ADSENSE */}
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6655664028880397"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>

      <body style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <div style={{ flex: 1 }}>
          {children}
        </div>

        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          background: '#0B0B0F',
        }}>
          <a href="/terminos" style={globalFooterLinkStyle}>
            Términos
          </a>

          <a href="/privacidad" style={globalFooterLinkStyle}>
            Privacidad
          </a>

          <a href="/faq" style={globalFooterLinkStyle}>
            FAQ
          </a>

          <a href="/contacto" style={globalFooterLinkStyle}>
            Contacto
          </a>
        </footer>

        
      </body>
    </html>
  )
}