import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { notifyExpenseAdded } from '@/lib/notify'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()
  const action = String(formData.get('action') ?? 'create')

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return NextResponse.redirect(
      new URL('/expenses?error=not-authenticated', request.url)
    )
  }

  const { data: familyMember, error: memberError } = await supabase
    .from('family_members')
    .select('id, full_name')
    .eq('email', user.email)
    .single()

  if (memberError || !familyMember) {
    return NextResponse.redirect(
      new URL('/expenses?error=not-authenticated', request.url)
    )
  }

  if (action === 'delete') {
    const expenseId = String(formData.get('expenseId') ?? '')
    if (!expenseId) {
      return NextResponse.redirect(
        new URL('/expenses?error=missing-expense', request.url)
      )
    }
    await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
    await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('created_by', familyMember.id)
    return NextResponse.redirect(new URL('/expenses', request.url))
  }

  // --- create ---
  const title = String(formData.get('title') ?? '').trim()
  const amountRaw = parseFloat(String(formData.get('amount') ?? '0'))
  const paidBy = String(formData.get('paid_by') ?? familyMember.id)
  const category = String(formData.get('category') ?? 'other')
  const dateRaw = String(formData.get('date') ?? '').trim()
  const notesRaw = String(formData.get('notes') ?? '').trim()
  const splitType = String(formData.get('split_type') ?? 'equal')

  if (!title || isNaN(amountRaw) || amountRaw <= 0) {
    return NextResponse.redirect(
      new URL('/expenses?error=missing-fields', request.url)
    )
  }

  // Validate participant selection depending on split mode
  const participantIds = formData.getAll('participants') as string[]
  const familyParticipantIds = formData.getAll('family_participants') as string[]

  const hasParticipants =
    splitType === 'per_family'
      ? familyParticipantIds.length > 0
      : participantIds.length > 0

  if (!hasParticipants) {
    return NextResponse.redirect(
      new URL('/expenses?error=no-participants', request.url)
    )
  }

  const date = dateRaw || new Date().toISOString().split('T')[0]
  const notes = notesRaw || null

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      title,
      amount: amountRaw,
      paid_by: paidBy,
      category,
      date,
      notes,
      split_type: splitType,
      created_by: familyMember.id,
    })
    .select('id')
    .single()

  if (expenseError || !expense) {
    return NextResponse.redirect(
      new URL('/expenses?error=insert-failed', request.url)
    )
  }

  // --- build splits ---
  let splits: { expense_id: string; member_id: string; amount: number }[] = []

  if (splitType === 'per_family') {
    // Look up the payer's household so we can exclude it from splits —
    // the payer's household already covered their share by paying.
    const { data: payerMember } = await supabase
      .from('family_members')
      .select('household_id')
      .eq('id', paidBy)
      .single()
    const payerHouseholdId = payerMember?.household_id ?? null

    // Fetch all members belonging to the selected households
    const { data: householdMembers } = await supabase
      .from('family_members')
      .select('id, household_id')
      .in('household_id', familyParticipantIds)

    // Group member IDs by household, skipping the payer's household
    const byHousehold: Record<string, string[]> = {}
    for (const m of householdMembers ?? []) {
      if (!m.household_id) continue
      if (m.household_id === payerHouseholdId) continue  // payer's household owes nothing
      if (!byHousehold[m.household_id]) byHousehold[m.household_id] = []
      byHousehold[m.household_id].push(m.id)
    }

    // Only the non-payer households owe anything
    const owingHouseholdIds = familyParticipantIds.filter(
      (hid) => hid !== payerHouseholdId
    )
    const numHouseholds = familyParticipantIds.length  // total including payer's, for equal share calc
    const basePerHousehold =
      Math.floor((amountRaw / numHouseholds) * 100) / 100

    for (let hi = 0; hi < owingHouseholdIds.length; hi++) {
      const householdId = owingHouseholdIds[hi]
      const memberIds = byHousehold[householdId] ?? []
      if (memberIds.length === 0) continue

      // Last owing household absorbs any rounding remainder
      const householdShare =
        hi === owingHouseholdIds.length - 1
          ? Math.round(
              (amountRaw - basePerHousehold * (numHouseholds - 1)) * 100
            ) / 100
          : basePerHousehold

      const basePerMember =
        Math.floor((householdShare / memberIds.length) * 100) / 100
      const memberRemainder =
        Math.round(
          (householdShare - basePerMember * memberIds.length) * 100
        ) / 100

      for (let mi = 0; mi < memberIds.length; mi++) {
        splits.push({
          expense_id: expense.id,
          member_id: memberIds[mi],
          amount:
            mi === memberIds.length - 1
              ? basePerMember + memberRemainder
              : basePerMember,
        })
      }
    }
  } else if (splitType === 'custom') {
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('custom_amount_')) continue
      const memberId = key.replace('custom_amount_', '')
      if (!participantIds.includes(memberId)) continue
      const amt = parseFloat(String(value))
      if (!isNaN(amt) && amt > 0) {
        splits.push({ expense_id: expense.id, member_id: memberId, amount: amt })
      }
    }
  } else {
    // equal split across individuals
    const base = Math.floor((amountRaw / participantIds.length) * 100) / 100
    const remainder =
      Math.round((amountRaw - base * participantIds.length) * 100) / 100
    splits = participantIds.map((memberId, i) => ({
      expense_id: expense.id,
      member_id: memberId,
      amount: i === participantIds.length - 1 ? base + remainder : base,
    }))
  }

  if (splits.length > 0) {
    await supabase.from('expense_splits').insert(splits)
  }

  // Notify everyone who has a split (excluding the payer — they already know)
  const notifyIds = splits
    .map((s) => s.member_id)
    .filter((id) => id !== paidBy)

  if (notifyIds.length > 0) {
    await notifyExpenseAdded({
      recipientIds: notifyIds,
      payerName: familyMember.full_name,
      expenseTitle: title,
      amount: amountRaw,
    })
  }

  return NextResponse.redirect(new URL('/expenses', request.url))
}
