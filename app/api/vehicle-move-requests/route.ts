import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  notifyVehicleMoveRequested,
  notifyVehicleMoveResolved,
} from '@/lib/notify'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()
  const vehicleId = String(formData.get('vehicleId') ?? '')
  const action = String(formData.get('action') ?? 'request')

  if (!vehicleId) {
    return NextResponse.redirect(
      new URL('/vehicles?error=missing-vehicle', request.url)
    )
  }

  if (action === 'resolve') {
    // Fetch who made the request + vehicle details in parallel before resolving
    const [{ data: openRequests }, { data: vehicle }] = await Promise.all([
      supabase
        .from('vehicle_move_requests')
        .select('requested_by')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'open'),
      supabase
        .from('vehicles')
        .select('label, owner_id')
        .eq('id', vehicleId)
        .maybeSingle(),
    ])

    await supabase
      .from('vehicle_move_requests')
      .update({ status: 'resolved' })
      .eq('vehicle_id', vehicleId)
      .eq('status', 'open')

    // Auto-close related in-app notifications
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('related_vehicle_id', vehicleId)
      .eq('type', 'vehicle_move_request')
      .eq('is_read', false)

    // Notify the requester that their request was fulfilled
    if (openRequests?.length && vehicle) {
      const requesterId = openRequests[0].requested_by
      if (requesterId) {
        const { data: resolver } = await supabase
          .from('family_members')
          .select('full_name')
          .eq('id', vehicle.owner_id)
          .maybeSingle()

        await notifyVehicleMoveResolved({
          recipientId: requesterId,
          resolverName: resolver?.full_name ?? 'בעל הרכב',
          vehicleLabel: vehicle.label,
          vehicleId,
        })
      }
    }

    return NextResponse.redirect(new URL('/vehicles', request.url))
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return NextResponse.redirect(
      new URL('/vehicles?error=missing-current-user', request.url)
    )
  }

  const { data: familyMember, error: familyMemberError } = await supabase
    .from('family_members')
    .select('id, full_name')
    .eq('email', user.email)
    .single()

  if (familyMemberError || !familyMember) {
    return NextResponse.redirect(
      new URL('/vehicles?error=missing-current-user', request.url)
    )
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, label, owner_id')
    .eq('id', vehicleId)
    .single()

  if (vehicleError || !vehicle) {
    return NextResponse.redirect(
      new URL('/vehicles?error=missing-vehicle', request.url)
    )
  }

  const { data: existingRequest, error: existingError } = await supabase
    .from('vehicle_move_requests')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'open')
    .maybeSingle()

  if (existingError) {
    return NextResponse.redirect(
      new URL('/vehicles?error=existing-check-failed', request.url)
    )
  }

  if (!existingRequest) {
    const { error: insertError } = await supabase
      .from('vehicle_move_requests')
      .insert({
        vehicle_id: vehicleId,
        requested_by: familyMember.id,
        status: 'open',
      })

    if (insertError) {
      return NextResponse.redirect(
        new URL('/vehicles?error=insert-failed', request.url)
      )
    }

    if (vehicle.owner_id && vehicle.owner_id !== familyMember.id) {
      await notifyVehicleMoveRequested({
        recipientId: vehicle.owner_id,
        requesterName: familyMember.full_name,
        vehicleLabel: vehicle.label,
        vehicleId: vehicle.id,
      })
    }
  }

  return NextResponse.redirect(new URL('/vehicles', request.url))
}
