import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'

type Vehicle = {
  id: string
  label: string
  plate_number: string | null
  status: 'present' | 'absent' | 'blocking' | 'movable'
  owner_id: string | null
}

type FamilyMember = {
  id: string
  full_name: string
}

type MoveRequest = {
  id: string
  vehicle_id: string
  requested_by: string | null
  status: 'open' | 'resolved'
  created_at?: string
}

function getStatusLabel(status: Vehicle['status']) {
  switch (status) {
    case 'present':  return 'נמצא במשק'
    case 'absent':   return 'לא במשק'
    case 'blocking': return 'חוסם'
    case 'movable':  return 'ניתן להזזה'
    default:         return status
  }
}

function getStatusStyle(status: Vehicle['status']) {
  switch (status) {
    case 'present':  return 'bg-[#e8eef5] text-[#3a5a7a]'
    case 'absent':   return 'bg-[#ede7d8] text-[#6c7664]'
    case 'blocking': return 'bg-red-100 text-red-700'
    case 'movable':  return 'bg-[#eef2e8] text-[#4a6b3a]'
    default:         return 'bg-[#ede7d8] text-[#6c7664]'
  }
}

function getErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case 'missing-vehicle':        return 'לא נבחר רכב לבקשת ההזזה.'
    case 'missing-current-user':   return 'לא נמצא משתמש מחובר.'
    case 'existing-check-failed':  return 'אירעה שגיאה בבדיקת בקשה קיימת.'
    case 'insert-failed':          return 'אירעה שגיאה ביצירת בקשת ההזזה.'
    default:                       return null
  }
}

export default async function VehiclesPage({
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

  const [
    { data: vehiclesData, error: vehiclesError },
    { data: membersData, error: membersError },
    { data: requestsData, error: requestsError },
  ] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: true }),
    supabase.from('family_members').select('id, full_name').order('full_name', { ascending: true }),
    supabase
      .from('vehicle_move_requests')
      .select('id, vehicle_id, requested_by, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
  ])

  const vehicles = (vehiclesData ?? []) as Vehicle[]
  const members = (membersData ?? []) as FamilyMember[]
  const requests = (requestsData ?? []) as MoveRequest[]

  const pageError =
    vehiclesError?.message || membersError?.message || requestsError?.message

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return 'לא ידוע'
    return members.find((m) => m.id === memberId)?.full_name ?? 'לא ידוע'
  }

  const getOpenRequestForVehicle = (vehicleId: string) =>
    requests.find((r) => r.vehicle_id === vehicleId) ?? null

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <TopBar
          title="רכבים במשק"
          subtitle="ניהול רכבים ובקשות להזזה"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">רשימת רכבים</h2>
              <p className="mt-1 text-sm text-[#6c7664]">{vehicles.length} רכבים רשומים</p>
            </div>
            <a
              href="/"
              className="rounded-xl border border-[#d8d1c2] px-4 py-2 text-sm text-[#5f6b58] hover:bg-[#f6f3ea]"
            >
              חזרה לדף הבית
            </a>
          </div>

          {errorMessage && (
            <p className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          {pageError && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              שגיאה בטעינת הנתונים: {pageError}
            </p>
          )}

          {!pageError && vehicles.length === 0 && (
            <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4 text-sm text-[#6c7664]">
              לא נמצאו רכבים.
            </div>
          )}

          {!pageError && vehicles.length > 0 && (
            <ul className="space-y-3">
              {vehicles.map((vehicle) => {
                const openRequest = getOpenRequestForVehicle(vehicle.id)
                const hasRequest = Boolean(openRequest)

                return (
                  <li
                    key={vehicle.id}
                    className={`rounded-2xl border p-4 transition-shadow hover:shadow-sm ${
                      hasRequest
                        ? 'border-red-200 bg-red-50'
                        : 'border-[#e4dece] bg-[#fcfaf4]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1.5">
                        <p className="text-base font-semibold text-[#2f3a2c]">
                          {vehicle.label}
                        </p>

                        <p className="text-sm text-[#5f6b58]">
                          בעל הרכב:{' '}
                          <span className="font-medium">
                            {getMemberName(vehicle.owner_id)}
                          </span>
                        </p>

                        <p className="text-sm text-[#5f6b58]">
                          מספר רישוי:{' '}
                          <span className="font-medium">
                            {vehicle.plate_number ?? 'לא הוזן'}
                          </span>
                        </p>

                        {hasRequest && (
                          <div className="mt-2 rounded-xl border border-red-200 bg-white/60 p-3">
                            <p className="text-sm font-semibold text-red-600">
                              ⚠️ יש בקשת הזזה פתוחה
                            </p>
                            <p className="mt-0.5 text-sm text-[#5f6b58]">
                              מי ביקש:{' '}
                              <span className="font-medium">
                                {getMemberName(openRequest?.requested_by ?? null)}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusStyle(vehicle.status)}`}
                        >
                          {getStatusLabel(vehicle.status)}
                        </span>

                        {!hasRequest && (
                          <form action="/api/vehicle-move-requests" method="POST">
                            <input type="hidden" name="vehicleId" value={vehicle.id} />
                            <button
                              type="submit"
                              className="rounded-xl bg-[#6f7f57] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#556343]"
                            >
                              בקש להזיז
                            </button>
                          </form>
                        )}

                        {hasRequest && (
                          <form action="/api/vehicle-move-requests" method="POST">
                            <input type="hidden" name="vehicleId" value={vehicle.id} />
                            <input type="hidden" name="action" value="resolve" />
                            <button
                              type="submit"
                              className="rounded-xl bg-[#4a6b3a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3a5a2c]"
                            >
                              סיימתי להזיז ✓
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
