import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'
import BabysitterTimer from '@/components/babysitter-timer'

type BabysitterSession = {
  id: string
  babysitter_id: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  hourly_rate: number
  created_by: string
}

type Member = {
  id: string
  full_name: string
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}ש׳ ${m}ד׳`
  if (h > 0) return `${h} שעות`
  return `${m} דקות`
}

function formatAmount(amount: number) {
  return `₪${amount.toFixed(2).replace(/\.00$/, '')}`
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export default async function BabysitterPage() {
  const currentUser = await getAuthenticatedFamilyMember()
  if (!currentUser) redirect('/login')

  const { unreadCount } = await getCurrentUserNotifications()
  const supabase = await createClient()

  const [
    { data: membersData },
    { data: activeData },
    { data: historyData },
  ] = await Promise.all([
    supabase
      .from('family_members')
      .select('id, full_name')
      .order('full_name', { ascending: true }),
    supabase
      .from('babysitter_sessions')
      .select('id, babysitter_id, started_at, ended_at, duration_minutes, hourly_rate, created_by')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1),
    supabase
      .from('babysitter_sessions')
      .select('id, babysitter_id, started_at, ended_at, duration_minutes, hourly_rate, created_by')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20),
  ])

  const members = (membersData ?? []) as Member[]
  const activeSession = ((activeData ?? []) as BabysitterSession[])[0] ?? null
  const history = (historyData ?? []) as BabysitterSession[]

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.full_name ?? 'לא ידוע'

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-lg space-y-6">
        <TopBar
          title="שמירת ילדים"
          subtitle="מעקב זמן ועלות בייביסיטר"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        {/* Timer card */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-8 shadow-sm">
          <BabysitterTimer
            members={members}
            initialSession={
              activeSession
                ? {
                    id: activeSession.id,
                    babysitter_id: activeSession.babysitter_id,
                    started_at: activeSession.started_at,
                    hourly_rate: activeSession.hourly_rate,
                  }
                : null
            }
          />
        </section>

        {/* History */}
        {history.length > 0 && (
          <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#2f3a2c]">היסטוריה</h2>
              <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs text-[#5c694f]">
                {history.length} שמירות
              </span>
            </div>

            <ul className="space-y-3">
              {history.map((s) => {
                const cost =
                  s.duration_minutes != null
                    ? (s.duration_minutes / 60) * s.hourly_rate
                    : null

                return (
                  <li
                    key={s.id}
                    className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-[#384332]">
                          {getMemberName(s.babysitter_id)}
                        </div>
                        <div className="text-xs text-[#7a8471]">
                          {formatDateTime(s.started_at)}
                        </div>
                      </div>
                      <div className="text-right space-y-0.5">
                        {s.duration_minutes != null && (
                          <div className="text-sm font-semibold text-[#2f3a2c]">
                            {formatDuration(s.duration_minutes)}
                          </div>
                        )}
                        {cost != null && (
                          <div className="text-sm font-bold text-[#a67c52]">
                            {formatAmount(cost)}
                          </div>
                        )}
                        <div className="text-xs text-[#a0a89a]">
                          {formatAmount(s.hourly_rate)}/ש׳
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <a
          href="/"
          className="block text-center text-sm text-[#7a8471] hover:text-[#5f6b58]"
        >
          ← חזרה לדף הבית
        </a>
      </div>
    </main>
  )
}
