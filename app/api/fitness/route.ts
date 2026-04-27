import { createClient } from '@/lib/supabase/server'
import { sendPushToMembers } from '@/lib/push'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return NextResponse.redirect(new URL('/fitness?error=not-authenticated', request.url))
  }

  const { data: sender } = await supabase
    .from('family_members')
    .select('id, full_name')
    .eq('email', user.email)
    .single()

  if (!sender) {
    return NextResponse.redirect(new URL('/fitness?error=not-authenticated', request.url))
  }

  // Fetch all other family members
  const { data: others } = await supabase
    .from('family_members')
    .select('id')
    .neq('id', sender.id)

  const recipientIds = (others ?? []).map((m) => m.id)

  if (recipientIds.length > 0) {
    const firstName = sender.full_name.split(' ')[0]

    // In-app notifications
    await supabase.from('notifications').insert(
      recipientIds.map((id) => ({
        recipient_id: id,
        type: 'fitness',
        title: 'אימון כושר!',
        message: `${firstName} מתחיל/ה אימון — מוזמנים!`,
        url: '/fitness',
        is_read: false,
      }))
    )

    // Push notifications
    await sendPushToMembers(recipientIds, {
      title: 'אימון כושר! 💪',
      body: `${firstName} מתחיל/ה אימון — מוזמנים!`,
      url: '/fitness',
      tag: 'fitness',
    })
  }

  return NextResponse.redirect(new URL('/fitness?sent=1', request.url))
}
