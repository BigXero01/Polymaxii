import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Polymaxii — AI BTC Trading',
  description: 'Automated Bitcoin 15-minute price prediction trading platform powered by AI',
  icons: { icon: '/favicon.ico' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Polymaxii' },
}

export const viewport: Viewport = {
  themeColor: '#0a0e1a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'hsl(222 47% 7%)',
                color: 'hsl(210 40% 98%)',
                border: '1px solid hsl(217 32% 14%)',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
