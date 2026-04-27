import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

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

  const formData = await request.formData()
  const today = new Date().toISOString().split('T')[0]

  // Support both array form (from[], to[], amount[]) and single values
  const froms = formData.getAll('from[]') as string[]
  const tos = formData.getAll('to[]') as string[]
  const amounts = formData.getAll('amount[]') as string[]

  if (froms.length === 0) {
    // Fallback: single settlement (legacy)
    const fromMemberId = String(formData.get('from_member_id') ?? '')
    const toMemberId = String(formData.get('to_member_id') ?? '')
    const amount = parseFloat(String(formData.get('amount') ?? '0'))
    if (fromMemberId && toMemberId && amount > 0) {
      await supabase.from('settlements').insert({
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        amount,
        date: today,
        created_by: familyMember.id,
      })
    }
    return NextResponse.redirect(new URL('/expenses', request.url))
  }

  // Insert one settlement row per pair
  const rows = froms
    .map((from, i) => ({
      from_member_id: from,
      to_member_id: tos[i] ?? '',
      amount: parseFloat(amounts[i] ?? '0'),
      date: today,
      created_by: familyMember.id,
    }))
    .filter((r) => r.from_member_id && r.to_member_id && r.amount > 0)

  if (rows.length > 0) {
    await supabase.from('settlements').insert(rows)
  }

  return NextResponse.redirect(new URL('/expenses', request.url))
}
