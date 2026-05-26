import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PaperTrader — Virtual Stock Trading',
  description: 'Trade real stocks with $100,000 in virtual money',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
