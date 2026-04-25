import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'

type PoolReservation = {
  id: string
  reserved_by: string
  date: string
  start_time: string
  end_time: string
  reservation_type: string
  notes: string | null
  status: 'active' | 'cancelled'
  created_at: string
}

type FamilyMember = {
  id: string
  full_name: string
}

function getReservationTypeLabel(type: string) {
  switch (type) {
    case 'private':
      return 'שימוש פרטי'
    case 'event':
      return 'אירוע משפחתי'
    case 'cleaning':
      return 'ניקיון'
    case 'maintenance':
      return 'תחזוקה'
    default:
      return type
  }
}

function getReservationTypeStyle(type: string) {
  switch (type) {
    case 'private':
      return 'bg-[#e8eef5] text-[#3a5a7a]'
    case 'event':
      return 'bg-[#ede8f5] text-[#6b5a80]'
    case 'cleaning':
      return 'bg-[#eef2e8] text-[#4a6b3a]'
    case 'maintenance':
      return 'bg-[#f5eede] text-[#8b6b3a]'
    default:
      return 'bg-[#ede7d8] text-[#6c7664]'
  }
}

function getErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case 'not-authenticated':
      return 'יש להתחבר מחדש.'
    case 'missing-fields':
      return 'יש למלא תאריך, שעת התחלה ושעת סיום.'
    case 'insert-failed':
      return 'אירעה שגיאה בשמירת השריון. נסו שוב.'
    case 'missing-reservation':
      return 'לא נמצא שריון לביטול.'
    default:
      return null
  }
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default async function PoolPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const errorMessage = getErrorMessage(resolvedSearchParams.error)

  const currentUser = await getAuthenticatedFamilyMember()
  if (!currentUser) redirect('/login')

  const { unreadCount } = await getCurrentUserNotifications()
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: reservationsData, error: reservationsError } = await supabase
    .from('pool_reservations')
    .select('*')
    .eq('status', 'active')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  const { data: membersData } = await supabase
    .from('family_members')
    .select('id, full_name')

  const reservations = (reservationsData ?? []) as PoolReservation[]
  const members = (membersData ?? []) as FamilyMember[]

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.full_name ?? 'לא ידוע'

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <TopBar
          title="בריכה"
          subtitle="שריון זמנים ועדכון שאר המשפחה"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        {errorMessage && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        {/* Add reservation */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">שריון חדש</h2>
              <p className="mt-1 text-sm text-[#6c7664]">
                בחרו תאריך, שעות וסוג שריון — שאר המשפחה יקבלו התראה
              </p>
            </div>
            <a
              href="/"
              className="rounded-xl border border-[#d8d1c2] px-4 py-2 text-sm text-[#5f6b58] hover:bg-[#f6f3ea]"
            >
              חזרה לדף הבית
            </a>
          </div>

          <form
            action="/api/pool-reservations"
            method="POST"
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  תאריך
                </label>
                <input
                  name="date"
                  type="date"
                  required
                  min={today}
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  סוג שריון
                </label>
                <select
                  name="reservation_type"
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                >
                  <option value="private">שימוש פרטי</option>
                  <option value="event">אירוע משפחתי</option>
                  <option value="cleaning">ניקיון</option>
                  <option value="maintenance">תחזוקה</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  שעת התחלה
                </label>
                <input
                  name="start_time"
                  type="time"
                  required
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  שעת סיום
                </label>
                <input
                  name="end_time"
                  type="time"
                  required
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#384332]">
                הערות (אופציונלי)
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="פרטים נוספים..."
                className="w-full resize-none rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-[#2f3a2c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#232b20]"
            >
              שמירת שריון
            </button>
          </form>
        </section>

        {/* Upcoming reservations */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">
                שריונות קרובים
              </h2>
              <p className="mt-1 text-sm text-[#6c7664]">
                כל השריונות הפעילים מהיום והלאה
              </p>
            </div>
            <div className="rounded-full bg-[#eef2e8] px-4 py-2 text-sm text-[#5c694f]">
              {reservations.length} שריונות
            </div>
          </div>

          {reservationsError && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              שגיאה בטעינת הנתונים: {reservationsError.message}
            </p>
          )}

          {!reservationsError && reservations.length === 0 && (
            <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4 text-sm text-[#6c7664]">
              אין שריונות קרובים. השתמשו בטופס למעלה כדי לשריין את הבריכה.
            </div>
          )}

          {!reservationsError && reservations.length > 0 && (
            <ul className="space-y-3">
              {reservations.map((reservation) => {
                const isOwner = reservation.reserved_by === currentUser.id
                return (
                  <li
                    key={reservation.id}
                    className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-[#384332]">
                            {formatDate(reservation.date)}
                          </span>
                          <span className="text-sm text-[#6c7664]">
                            {reservation.start_time.slice(0, 5)}
                            {' – '}
                            {reservation.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <p className="text-sm text-[#5f6b58]">
                          שריין/ה:{' '}
                          <span className="font-medium">
                            {getMemberName(reservation.reserved_by)}
                          </span>
                        </p>
                        {reservation.notes && (
                          <p className="text-sm text-[#7a8471]">
                            {reservation.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${getReservationTypeStyle(reservation.reservation_type)}`}
                        >
                          {getReservationTypeLabel(reservation.reservation_type)}
                        </span>

                        {isOwner && (
                          <form
                            action="/api/pool-reservations"
                            method="POST"
                          >
                            <input
                              type="hidden"
                              name="action"
                              value="cancel"
                            />
                            <input
                              type="hidden"
                              name="reservationId"
                              value={reservation.id}
                            />
                            <button
                              type="submit"
                              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                            >
                              ביטול
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
