'use client'

/**
 * PwaInstallButton
 *
 * Listens for Chrome's `beforeinstallprompt` event, which fires when the
 * browser considers the PWA installable. Saves the event and shows an
 * "Install app" button. When tapped, triggers the native Chrome install
 * dialog that installs the app in standalone (full-screen) mode.
 *
 * This is the only reliable way to trigger PWA installation — relying on
 * Chrome to show the banner automatically is not dependable.
 */

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already running in standalone mode — no button needed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault() // Stop Chrome's automatic mini-banner
      setInstallEvent(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setInstallEvent(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setInstallEvent(null)
    }
  }

  // Don't render if already installed or no install event yet
  if (installed || !installEvent) return null

  return (
    <div className="rounded-3xl border border-[#c8d8a8] bg-[#f4f8ee] p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#e2ecd4] text-2xl">
          📲
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#2f3a2c]">
            התקינו את האפליקציה
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#5f6b58]">
            הוסיפו למסך הבית לגישה מהירה ופתיחה במסך מלא ללא דפדפן.
          </p>
        </div>
      </div>
      <button
        onClick={handleInstall}
        className="mt-4 w-full rounded-2xl bg-[#4a6b3a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3a5a2c]"
      >
        התקן אפליקציה
      </button>
    </div>
  )
}
