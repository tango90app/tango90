import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tango90 | Calificá a los jugadores',
  description: 'La plataforma argentina para calificar jugadores, técnicos y árbitros',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
