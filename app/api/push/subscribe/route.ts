import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * POST /api/push/subscribe
 *
 * Saves (or refreshes) a PushSubscription for the current user's device.
 * The endpoint is unique per browser/device so we upsert on it.
 *
 * Body: { endpoint: string, p256dh: string, auth: string }
 */
export async function POST(request: Request) {
  const currentUser = await getAuthenticatedFamilyMember()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { endpoint?: string; p256dh?: string; auth?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { endpoint, p256dh, auth } = body
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: currentUser.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent') ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('[push/subscribe] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
