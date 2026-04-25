import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()
  const action = String(formData.get('action') ?? 'single')
  const redirectTo = String(formData.get('redirectTo') ?? '/')

  if (action === 'mark-all') {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.email) {
      const { data: familyMember } = await supabase
        .from('family_members')
        .select('id')
        .eq('email', user.email)
        .single()

      if (familyMember) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('recipient_id', familyMember.id)
          .eq('is_read', false)
      }
    }

    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // single
  const notificationId = String(formData.get('notificationId') ?? '')
  if (!notificationId) {
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  return NextResponse.redirect(new URL(redirectTo, request.url))
}
