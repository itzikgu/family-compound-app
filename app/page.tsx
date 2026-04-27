import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { logout } from '@/app/login/actions'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'
import PushEnableButton from '@/components/push-enable-button'
import PwaInstallButton from '@/components/pwa-install-button'

type Household = {
  id: string
  name: string
}

export default async function HomePage() {
  const currentUser = await getAuthenticatedFamilyMember()

  if (!currentUser) {
    redirect('/login')
  }

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { notifications, unreadCount },
    { data: households },
    { count: openTasksCount },
    { count: myTasksCount },
    { count: upcomingPoolCount },
    { count: openMoveRequestsCount },
    { count: totalExpensesCount },
  ] = await Promise.all([
    getCurrentUserNotifications(),
    supabase
      .from('households')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .eq('assigned_to', currentUser.id),
    supabase
      .from('pool_reservations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('date', today),
    supabase
      .from('vehicle_move_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true }),
  ])

  const safeHouseholds = (households ?? []) as Household[]
  const openTasks = openTasksCount ?? 0
  const myTasks = myTasksCount ?? 0
  const upcomingPool = upcomingPoolCount ?? 0
  const openMoveRequests = openMoveRequestsCount ?? 0
  const totalExpenses = totalExpensesCount ?? 0

  return (
    <main className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <TopBar
          title="המשק המשפחתי"
          subtitle="רכבים · בריכה · משימות · הוצאות · בייביסיטר"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        {/* Quick-action strip */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          <a
            href="/vehicles"
            className="group flex flex-col items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-[#fffdf8] p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9efdf] text-2xl">
              🚗
            </div>
            <span className="text-sm font-semibold text-[#2f3a2c]">רכבים</span>
            {openMoveRequests > 0 ? (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                {openMoveRequests} בקשות
              </span>
            ) : (
              <span className="rounded-full bg-[#eef2e8] px-2.5 py-0.5 text-xs text-[#5c694f]">
                תקין
              </span>
            )}
          </a>

          <a
            href="/pool"
            className="group flex flex-col items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-[#fffdf8] p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e4f0f5] text-2xl">
              🏊
            </div>
            <span className="text-sm font-semibold text-[#2f3a2c]">בריכה</span>
            {upcomingPool > 0 ? (
              <span className="rounded-full bg-[#e8eef5] px-2.5 py-0.5 text-xs font-semibold text-[#3a5a7a]">
                {upcomingPool} שריונות
              </span>
            ) : (
              <span className="rounded-full bg-[#eef2e8] px-2.5 py-0.5 text-xs text-[#5c694f]">
                פנויה
              </span>
            )}
          </a>

          <a
            href="/tasks"
            className="group flex flex-col items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-[#fffdf8] p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2eadf] text-2xl">
              🌿
            </div>
            <span className="text-sm font-semibold text-[#2f3a2c]">משימות</span>
            {openTasks > 0 ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  myTasks > 0
                    ? 'bg-[#e6f0d8] text-[#4a6b3a]'
                    : 'bg-[#eef2e8] text-[#5c694f]'
                }`}
              >
                {openTasks} פתוחות
              </span>
            ) : (
              <span className="rounded-full bg-[#eef2e8] px-2.5 py-0.5 text-xs text-[#5c694f]">
                הכול בוצע ✓
              </span>
            )}
          </a>

          <a
            href="/expenses"
            className="group flex flex-col items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-[#fffdf8] p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3eee3] text-2xl">
              💸
            </div>
            <span className="text-sm font-semibold text-[#2f3a2c]">הוצאות</span>
            <span className="rounded-full bg-[#f3eee3] px-2.5 py-0.5 text-xs text-[#a67c52]">
              {totalExpenses} רשומות
            </span>
          </a>

          <a
            href="/babysitter"
            className="group flex flex-col items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-[#fffdf8] p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5edf5] text-2xl">
              👶
            </div>
            <span className="text-sm font-semibold text-[#2f3a2c]">בייביסיטר</span>
            <span className="rounded-full bg-[#f5edf5] px-2.5 py-0.5 text-xs text-[#7a4a7a]">
              מעקב זמן
            </span>
          </a>
        </section>

        {/* PWA install prompt — only appears when Chrome fires beforeinstallprompt */}
        <PwaInstallButton />

        {/* Push notification opt-in — client component, renders nothing until ready */}
        <PushEnableButton />

        {/* My tasks highlight — only shown when there are tasks assigned to me */}
        {myTasks > 0 && (
          <section className="rounded-3xl border border-[#c8d8a8] bg-[#f4f8ee] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#3a5a2c]">
                  יש לך {myTasks} משימ{myTasks === 1 ? 'ה' : 'ות'} שמחכ{myTasks === 1 ? 'ה' : 'ות'} לך
                </p>
                <p className="mt-0.5 text-xs text-[#5f6b58]">לחצו לצפייה ולסימון כבוצע</p>
              </div>
              <a
                href="/tasks"
                className="rounded-xl bg-[#6f7f57] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#556343]"
              >
                למשימות שלי
              </a>
            </div>
          </section>
        )}

        {/* Notifications */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#2f3a2c]">התראות</h2>
              <p className="mt-0.5 text-xs text-[#6c7664]">
                {unreadCount > 0 ? `${unreadCount} לא נקראו` : 'הכול נקרא'}
              </p>
            </div>
            {notifications.length > 0 && (
              <a
                href="/notifications"
                className="rounded-xl border border-[#d8d1c2] px-3 py-1.5 text-xs text-[#5f6b58] hover:bg-[#f6f3ea]"
              >
                כל ההתראות
              </a>
            )}
          </div>

          {notifications.length === 0 && (
            <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4 text-sm text-[#6c7664]">
              אין כרגע התראות.
            </div>
          )}

          {notifications.length > 0 && (
            <div className="space-y-2.5">
              {notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-2xl border p-4 ${
                    notification.is_read
                      ? 'border-[#e4dece] bg-[#fcfaf4]'
                      : 'border-[#d9c89a] bg-[#fff8e8]'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[#384332]">
                        {notification.title}
                      </div>
                      <div className="mt-0.5 text-sm text-[#5f6b58]">
                        {notification.message}
                      </div>
                    </div>

                    {!notification.is_read && (
                      <form action="/api/notifications/read" method="POST">
                        <input
                          type="hidden"
                          name="notificationId"
                          value={notification.id}
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
              ))}
              {notifications.length > 5 && (
                <a
                  href="/notifications"
                  className="block rounded-2xl border border-[#e4dece] p-3 text-center text-sm text-[#6f7f57] hover:bg-[#f6f3ea]"
                >
                  עוד {notifications.length - 5} התראות ←
                </a>
              )}
            </div>
          )}
        </section>

        {/* Households + Logout */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#2f3a2c]">בתי האב</h2>
              <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs text-[#5c694f]">
                {safeHouseholds.length} בתי אב
              </span>
            </div>

            {safeHouseholds.length === 0 && (
              <p className="text-sm text-[#7a8471]">לא נמצאו בתי אב.</p>
            )}

            {safeHouseholds.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {safeHouseholds.map((household) => (
                  <div
                    key={household.id}
                    className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-[#384332]">
                      {household.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col justify-between rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-5 shadow-sm md:min-w-[200px]">
            <div>
              <p className="text-xs text-[#6c7664]">מחובר כעת</p>
              <p className="mt-1 text-base font-semibold text-[#2f3a2c]">
                {currentUser.full_name}
              </p>
              <p className="mt-0.5 text-xs text-[#7a8471]">{currentUser.email}</p>
            </div>
            <form action={logout} className="mt-5">
              <button
                type="submit"
                className="w-full rounded-2xl border border-[#d8d1c2] px-4 py-2.5 text-sm font-semibold text-[#5f6b58] transition hover:bg-[#f6f3ea]"
              >
                התנתקות
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
