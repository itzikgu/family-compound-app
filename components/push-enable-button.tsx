'use client'

/**
 * PushEnableButton
 *
 * Shows a prompt card to enable push notifications when permission has not
 * yet been granted. On click it:
 *   1. Requests Notification permission from the browser.
 *   2. Subscribes to push via the service worker using our VAPID public key.
 *   3. POSTs the subscription to /api/push/subscribe so the server can
 *      send pushes to this device.
 *
 * Renders nothing while the permission status is loading, when the browser
 * does not support push, or when permission is already granted.
 */

import { useEffect, useState } from 'react'

type UIState = 'loading' | 'unsupported' | 'prompt' | 'subscribing' | 'granted' | 'denied'

/** Convert an ArrayBuffer to a standard base64 string. */
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export default function PushEnableButton() {
  const [state, setState] = useState<UIState>('loading')

  useEffect(() => {
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setState('unsupported')
      return
    }

    const perm = Notification.permission
    if (perm === 'granted') {
      // Permission already granted — get the browser's active subscription
      // and sync it to the server every time. This is an idempotent upsert,
      // so it's safe to call on every load. It fixes the case where the user
      // approved push before the DB table existed, or the server call failed.
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then(async (sub) => {
          if (!sub) {
            // Browser has no subscription despite permission — show the button
            setState('prompt')
            return
          }
          // Re-save to DB (upsert) to repair any missing row
          try {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: sub.endpoint,
                p256dh: bufToBase64(sub.getKey('p256dh')!),
                auth: bufToBase64(sub.getKey('auth')!),
              }),
            })
          } catch {
            // Network error — not fatal, button stays hidden
          }
          setState('granted')
        })
        .catch(() => setState('prompt'))
      return
    }

    setState(perm === 'denied' ? 'denied' : 'prompt')
  }, [])

  async function handleEnable() {
    setState('subscribing')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }

      const registration = await navigator.serviceWorker.ready

      // Re-use existing subscription or create a new one
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // Modern browsers accept the base64url key string directly
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        }))

      const p256dh = bufToBase64(subscription.getKey('p256dh')!)
      const auth = bufToBase64(subscription.getKey('auth')!)

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint, p256dh, auth }),
      })

      setState(res.ok ? 'granted' : 'prompt')
    } catch (err) {
      console.warn('[push] Subscription failed:', err)
      setState('prompt')
    }
  }

  // Nothing to show while loading or when browser doesn't support push
  if (state === 'loading' || state === 'unsupported') return null

  if (state === 'granted') return null

  if (state === 'denied') {
    return (
      <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] px-4 py-3 text-sm text-[#7a8471]">
        התראות חסומות בהגדרות הדפדפן. כדי להפעיל — שנו את הגדרות האתר ידנית.
      </div>
    )
  }

  // 'prompt' or 'subscribing'
  return (
    <div className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#e9efdf] text-2xl">
          🔔
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#2f3a2c]">
            קבלו התראות בזמן אמת
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#6c7664]">
            הפעילו כדי לקבל עדכונים ישירות לטלפון — הזזת רכב, משימות חדשות,
            שריון בריכה והוצאות משותפות.
          </p>
        </div>
      </div>
      <button
        onClick={handleEnable}
        disabled={state === 'subscribing'}
        className="mt-4 w-full rounded-2xl bg-[#2f3a2c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#232b20] disabled:opacity-60"
      >
        {state === 'subscribing' ? 'מפעיל...' : 'הפעל התראות לטלפון'}
      </button>
    </div>
  )
}
