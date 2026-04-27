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
        {/* Gveret Levin — used for the app title in TopBar */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Gveret+Levin&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PushProvider />
        {children}
      </body>
    </html>
  )
}
