import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Market Microstructure Dashboard',
  description: 'Real-time order book, VPIN, LOB Imbalance, and trade flow analytics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
