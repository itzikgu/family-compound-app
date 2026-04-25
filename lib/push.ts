/**
 * Server-side Web Push sending utility.
 *
 * We use `web-push` because implementing the Web Push Protocol with VAPID
 * authentication manually requires complex ECDH key agreement, JWT signing,
 * and AES-GCM encryption that would be error-prone and hard to maintain.
 *
 * This module is ONLY imported in server-side code (API routes / Server Actions).
 * Never import it in client components.
 */

import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

// VAPID keys are set once per process. Guard against missing config so the
// app still boots in dev without env vars — push simply becomes a no-op.
const VAPID_READY =
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_SUBJECT

if (VAPID_READY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

export interface PushPayload {
  title: string
  body: string
  /** Deep-link URL opened when the user taps the notification */
  url: string
  /**
   * Stable tag for deduplication — a new notification with the same tag
   * replaces any previous one in the notification tray.
   */
  tag?: string
}

/**
 * Send a push notification to every registered device of a given family member.
 * Stale subscriptions (410/404 responses) are automatically cleaned up.
 * Errors on individual devices are suppressed so one bad subscription can't
 * block delivery to the rest.
 */
export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<void> {
  if (!VAPID_READY) return

  const supabase = await createClient()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('member_id', memberId)

  if (!subscriptions?.length) return

  const payloadString = JSON.stringify(payload)

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadString
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        // 410 Gone / 404 Not Found = subscription is no longer valid
        if (status === 410 || status === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }
        // Other errors (e.g. 429 rate limit) are silently swallowed per device
      }
    })
  )
}

/**
 * Send a push notification to multiple members at once.
 * Useful for broadcasting (e.g. pool reservations notify everyone else).
 */
export async function sendPushToMembers(
  memberIds: string[],
  payload: PushPayload
): Promise<void> {
  if (!VAPID_READY || memberIds.length === 0) return
  await Promise.allSettled(memberIds.map((id) => sendPushToMember(id, payload)))
}
