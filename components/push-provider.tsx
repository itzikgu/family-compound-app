'use client'

/**
 * PushProvider
 *
 * Mounted once in the root layout. Registers /sw.js as soon as the browser
 * is ready. Does NOT request notification permission or prompt the user —
 * that is handled separately by PushEnableButton at a contextually
 * appropriate moment.
 */

import { useEffect } from 'react'

export default function PushProvider() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        // Non-fatal — app works fine without SW, just no push
        console.warn('[SW] Registration failed:', err)
      })
  }, [])

  return null
}
