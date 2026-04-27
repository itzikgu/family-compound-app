import type { Metadata, Viewport } from 'next'
import './globals.css'
import PushProvider from '@/components/push-provider'

export const metadata: Metadata = {
  title: 'ניהול המשק',
  description: 'אפליקציה לניהול המשק המשפחתי',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'המשק',
  },
}

export const viewport: Viewport = {
  themeColor: '#2f3a2c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* Apple touch icon for iOS home screen */}
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        <PushProvider />
        {children}
      </body>
    </html>
  )
}
