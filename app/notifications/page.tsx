import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'

const TYPE_ICON: Record<string, string> = {
  vehicle_move_request: '🚗',
  pool_reservation: '🏊',
  task_assigned: '🌿',
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function NotificationsPage() {
  const currentUser = await getAuthenticatedFamilyMember()
  if (!currentUser) redirect('/login')

  const { notifications, unreadCount } = await getCurrentUserNotifications()

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <TopBar
          title="התראות"
          subtitle="כל ההתראות שלך במקום אחד"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">
                כל ההתראות
              </h2>
              <p className="mt-1 text-sm text-[#6c7664]">
                {notifications.length} התראות · {unreadCount} לא נקראו
              </p>
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <form action="/api/notifications/read" method="POST">
                  <input type="hidden" name="action" value="mark-all" />
                  <input
                    type="hidden"
                    name="redirectTo"
                    value="/notifications"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#6f7f57] px-4 py-2 text-sm font-semibold text-white hover:bg-[#556343]"
                  >
                    סמן הכל כנקראו
                  </button>
                </form>
              )}
              <a
                href="/"
                className="rounded-xl border border-[#d8d1c2] px-4 py-2 text-sm text-[#5f6b58] hover:bg-[#f6f3ea]"
              >
                חזרה לדף הבית
              </a>
            </div>
          </div>

          {notifications.length === 0 && (
            <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-6 text-center text-sm text-[#6c7664]">
              אין כרגע התראות. כשמשהו יקרה במשק — תדע/י ראשון/ה.
            </div>
          )}

          {notifications.length > 0 && (
            <ul className="space-y-3">
              {notifications.map((notification) => {
                const icon = TYPE_ICON[notification.type] ?? '🔔'
                return (
                  <li
                    key={notification.id}
                    className={`rounded-2xl border p-4 ${
                      notification.is_read
                        ? 'border-[#e4dece] bg-[#fcfaf4]'
                        : 'border-[#d9c89a] bg-[#fff8e8]'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/70 text-xl shadow-sm">
                        {icon}
                      </div>

                      <div className="flex flex-1 flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-0.5">
                          <div
                            className={`text-base font-semibold ${
                              notification.is_read
                                ? 'text-[#6c7664]'
                                : 'text-[#384332]'
                            }`}
                          >
                            {notification.title}
                          </div>
                          <div className="text-sm text-[#5f6b58]">
                            {notification.message}
                          </div>
                          <div className="text-xs text-[#9a9e93]">
                            {formatDate(notification.created_at)}
                          </div>
                        </div>

                        {!notification.is_read && (
                          <form
                            action="/api/notifications/read"
                            method="POST"
                            className="mt-2 md:mt-0 md:flex-shrink-0"
                          >
                            <input
                              type="hidden"
                              name="notificationId"
                              value={notification.id}
                            />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value="/notifications"
                            />
                            <button
                              type="submit"
                              className="rounded-xl bg-[#6f7f57] px-4 py-2 text-sm font-semibold text-white hover:bg-[#556343]"
                            >
                              סמן כנקראה
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
