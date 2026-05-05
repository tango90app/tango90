import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

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
          textAlign: 'center',
          fontSize: 10,
          color: '#6B7280',
          padding: '14px 16px 18px',
          lineHeight: 1.4,
        }}>
          <div>El juego compulsivo es perjudicial para vos y tu familia.</div>
          <div>Si sos menor, no podés apostar.</div>
        </footer>
      </body>
    </html>
  )
}