import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * POST /api/push/unsubscribe
 *
 * Removes the push subscription for a specific endpoint.
 * Called when the user explicitly turns off push or when the
 * browser revokes permission.
 *
 * Body: { endpoint: string }
 */
export async function POST(request: Request) {
  const currentUser = await getAuthenticatedFamilyMember()
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { endpoint?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { endpoint } = body
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  const supabase = await createClient()

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('member_id', currentUser.id)

  return NextResponse.json({ ok: true })
}
