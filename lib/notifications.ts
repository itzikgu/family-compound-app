import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'

export type AppNotification = {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  type: string
  related_vehicle_id: string | null
}

export async function getCurrentUserNotifications() {
  const currentUser = await getAuthenticatedFamilyMember()

  if (!currentUser) {
    return {
      currentUser: null,
      notifications: [] as AppNotification[],
      unreadCount: 0,
    }
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('notifications')
    .select('id, title, message, is_read, created_at, type, related_vehicle_id')
    .eq('recipient_id', currentUser.id)
    .order('created_at', { ascending: false })

  const notifications = (data ?? []) as AppNotification[]
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    currentUser,
    notifications,
    unreadCount,
  }
}