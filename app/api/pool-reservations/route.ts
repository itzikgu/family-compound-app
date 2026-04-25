import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  notifyPoolReservation,
  notifyPoolReservationCancelled,
} from '@/lib/notify'

const RESERVATION_TYPE_LABELS: Record<string, string> = {
  private: 'שימוש פרטי',
  event: 'אירוע משפחתי',
  cleaning: 'ניקיון',
  maintenance: 'תחזוקה',
}

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
      new URL('/pool?error=not-authenticated', request.url)
    )
  }

  const { data: familyMember, error: memberError } = await supabase
    .from('family_members')
    .select('id, full_name')
    .eq('email', user.email)
    .single()

  if (memberError || !familyMember) {
    return NextResponse.redirect(
      new URL('/pool?error=not-authenticated', request.url)
    )
  }

  if (action === 'cancel') {
    const reservationId = String(formData.get('reservationId') ?? '')
    if (!reservationId) {
      return NextResponse.redirect(
        new URL('/pool?error=missing-reservation', request.url)
      )
    }

    // Fetch reservation date before cancelling for the notification
    const { data: reservation } = await supabase
      .from('pool_reservations')
      .select('date')
      .eq('id', reservationId)
      .eq('reserved_by', familyMember.id)
      .maybeSingle()

    await supabase
      .from('pool_reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .eq('reserved_by', familyMember.id)

    if (reservation) {
      const { data: allMembers } = await supabase
        .from('family_members')
        .select('id')

      const otherIds = (allMembers ?? [])
        .map((m: { id: string }) => m.id)
        .filter((id) => id !== familyMember.id)

      if (otherIds.length > 0) {
        const [year, month, day] = reservation.date.split('-')
        await notifyPoolReservationCancelled({
          recipientIds: otherIds,
          cancellerName: familyMember.full_name,
          dateFormatted: `${day}/${month}/${year}`,
        })
      }
    }

    return NextResponse.redirect(new URL('/pool', request.url))
  }

  const date = String(formData.get('date') ?? '')
  const startTime = String(formData.get('start_time') ?? '')
  const endTime = String(formData.get('end_time') ?? '')
  const reservationType = String(formData.get('reservation_type') ?? 'private')
  const notesRaw = String(formData.get('notes') ?? '').trim()
  const notes = notesRaw || null

  if (!date || !startTime || !endTime) {
    return NextResponse.redirect(
      new URL('/pool?error=missing-fields', request.url)
    )
  }

  const { error: insertError } = await supabase.from('pool_reservations').insert({
    reserved_by: familyMember.id,
    date,
    start_time: startTime,
    end_time: endTime,
    reservation_type: reservationType,
    notes,
    status: 'active',
  })

  if (insertError) {
    return NextResponse.redirect(
      new URL('/pool?error=insert-failed', request.url)
    )
  }

  const { data: allMembers } = await supabase
    .from('family_members')
    .select('id')

  const otherIds = (allMembers ?? [])
    .map((m: { id: string }) => m.id)
    .filter((id) => id !== familyMember.id)

  if (otherIds.length > 0) {
    const typeLabel = RESERVATION_TYPE_LABELS[reservationType] ?? reservationType
    const [year, month, day] = date.split('-')

    await notifyPoolReservation({
      recipientIds: otherIds,
      reserverName: familyMember.full_name,
      typeLabel,
      dateFormatted: `${day}/${month}/${year}`,
      startTime: startTime.slice(0, 5),
      endTime: endTime.slice(0, 5),
    })
  }

  return NextResponse.redirect(new URL('/pool', request.url))
}
