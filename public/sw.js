// Service Worker for Family Compound PWA
// Handles push notifications and basic lifecycle

const CACHE_VERSION = 'v1'

// ─── Lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ─── Push ─────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'עדכון חדש', body: event.data.text(), url: '/' }
  }

  const { title, body, url = '/', tag = 'default', icon = '/icon-192.png', badge = '/icon-96.png' } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      dir: 'rtl',
      lang: 'he',
      renotify: true,
      requireInteraction: false,
    })
  )
})

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing window if one is open
        for (const client of windowClients) {
          const clientUrl = new URL(client.url)
          if (clientUrl.origin === self.location.origin) {
            client.focus()
            return client.navigate(targetUrl)
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(targetUrl)
      })
  )
})
