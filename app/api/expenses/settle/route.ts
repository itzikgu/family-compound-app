import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return NextResponse.redirect(new URL('/expenses?error=not-authenticated', request.url))
  }

  const { data: familyMember } = await supabase
    .from('family_members')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!familyMember) {
    return NextResponse.redirect(new URL('/expenses?error=not-authenticated', request.url))
  }

  const fromMemberId = String(formData.get('from_member_id') ?? '')
  const toMemberId = String(formData.get('to_member_id') ?? '')
  const amount = parseFloat(String(formData.get('amount') ?? '0'))

  if (!fromMemberId || !toMemberId || isNaN(amount) || amount <= 0) {
    return NextResponse.redirect(new URL('/expenses', request.url))
  }

  await supabase.from('settlements').insert({
    from_member_id: fromMemberId,
    to_member_id: toMemberId,
    amount,
    date: new Date().toISOString().split('T')[0],
    created_by: familyMember.id,
  })

  return NextResponse.redirect(new URL('/expenses', request.url))
}
