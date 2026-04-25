/**
 * Unified notification creator.
 *
 * Every event in the app that needs to notify a family member should call
 * one of these helpers. Each helper:
 *   1. Inserts an in-app notification row into Supabase.
 *   2. Fires a Web Push notification to every device the recipient has registered.
 *
 * Keeping creation in one place prevents notification logic from being
 * scattered across API routes and makes it easy to extend later.
 */

import { createClient } from '@/lib/supabase/server'
import { sendPushToMember, sendPushToMembers } from '@/lib/push'

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface NotificationRow {
  recipient_id: string
  type: string
  title: string
  message: string
  related_vehicle_id?: string | null
  url: string
}

async function insertNotification(row: NotificationRow) {
  const supabase = await createClient()
  await supabase.from('notifications').insert({
    recipient_id: row.recipient_id,
    type: row.type,
    title: row.title,
    message: row.message,
    related_vehicle_id: row.related_vehicle_id ?? null,
    url: row.url,
    is_read: false,
  })
}

async function insertAndPush(row: NotificationRow) {
  await insertNotification(row)
  await sendPushToMember(row.recipient_id, {
    title: row.title,
    body: row.message,
    url: row.url,
    tag: row.type,
  })
}

// ─── Vehicle move requests ────────────────────────────────────────────────────

export async function notifyVehicleMoveRequested(opts: {
  recipientId: string
  requesterName: string
  vehicleLabel: string
  vehicleId: string
}) {
  await insertAndPush({
    recipient_id: opts.recipientId,
    type: 'vehicle_move_request',
    title: 'בקשה להזיז רכב',
    message: `${opts.requesterName} ביקש/ה להזיז את הרכב "${opts.vehicleLabel}"`,
    related_vehicle_id: opts.vehicleId,
    url: '/vehicles',
  })
}

export async function notifyVehicleMoveResolved(opts: {
  recipientId: string
  resolverName: string
  vehicleLabel: string
  vehicleId: string
}) {
  await insertAndPush({
    recipient_id: opts.recipientId,
    type: 'vehicle_move_resolved',
    title: 'הרכב הוזז',
    message: `${opts.resolverName} הזיז/ה את הרכב "${opts.vehicleLabel}"`,
    related_vehicle_id: opts.vehicleId,
    url: '/vehicles',
  })
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function notifyTaskAssigned(opts: {
  recipientId: string
  assignerName: string
  taskTitle: string
}) {
  await insertAndPush({
    recipient_id: opts.recipientId,
    type: 'task_assigned',
    title: 'משימה חדשה הוקצתה לך',
    message: `${opts.assignerName} הקצה/תה לך משימה: "${opts.taskTitle}"`,
    url: '/tasks',
  })
}

export async function notifyTaskCompleted(opts: {
  recipientId: string
  completerName: string
  taskTitle: string
}) {
  await insertAndPush({
    recipient_id: opts.recipientId,
    type: 'task_completed',
    title: 'משימה הושלמה',
    message: `${opts.completerName} סיים/ה את המשימה: "${opts.taskTitle}"`,
    url: '/tasks',
  })
}

// ─── Pool reservations ────────────────────────────────────────────────────────

export async function notifyPoolReservation(opts: {
  recipientIds: string[]
  reserverName: string
  typeLabel: string
  dateFormatted: string
  startTime: string
  endTime: string
}) {
  const title = 'שריון בריכה'
  const message = `${opts.reserverName} שריין/ה את הבריכה — ${opts.typeLabel} בתאריך ${opts.dateFormatted} בשעות ${opts.startTime}–${opts.endTime}`

  // Insert all in-app rows in one batch
  const supabase = await createClient()
  if (opts.recipientIds.length > 0) {
    await supabase.from('notifications').insert(
      opts.recipientIds.map((id) => ({
        recipient_id: id,
        type: 'pool_reservation',
        title,
        message,
        url: '/pool',
        is_read: false,
      }))
    )
  }

  // Push in parallel
  await sendPushToMembers(opts.recipientIds, {
    title,
    body: message,
    url: '/pool',
    tag: 'pool_reservation',
  })
}

export async function notifyPoolReservationCancelled(opts: {
  recipientIds: string[]
  cancellerName: string
  dateFormatted: string
}) {
  const title = 'שריון בריכה בוטל'
  const message = `${opts.cancellerName} ביטל/ה את שריון הבריכה בתאריך ${opts.dateFormatted}`

  const supabase = await createClient()
  if (opts.recipientIds.length > 0) {
    await supabase.from('notifications').insert(
      opts.recipientIds.map((id) => ({
        recipient_id: id,
        type: 'pool_reservation_cancelled',
        title,
        message,
        url: '/pool',
        is_read: false,
      }))
    )
  }

  await sendPushToMembers(opts.recipientIds, {
    title,
    body: message,
    url: '/pool',
    tag: 'pool_reservation',
  })
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function notifyExpenseAdded(opts: {
  recipientIds: string[]
  payerName: string
  expenseTitle: string
  amount: number
}) {
  const amountFormatted = `₪${opts.amount.toFixed(2).replace(/\.00$/, '')}`
  const title = 'הוצאה משותפת חדשה'
  const message = `${opts.payerName} הוסיף/ה הוצאה: "${opts.expenseTitle}" — ${amountFormatted}`

  const supabase = await createClient()
  if (opts.recipientIds.length > 0) {
    await supabase.from('notifications').insert(
      opts.recipientIds.map((id) => ({
        recipient_id: id,
        type: 'expense_added',
        title,
        message,
        url: '/expenses',
        is_read: false,
      }))
    )
  }

  await sendPushToMembers(opts.recipientIds, {
    title,
    body: message,
    url: '/expenses',
    tag: 'expense_added',
  })
}
