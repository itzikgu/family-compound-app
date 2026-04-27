import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'

export default async function FitnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ sent?: string; error?: string }>
}) {
  const params = (await searchParams) ?? {}

  const currentUser = await getAuthenticatedFamilyMember()
  if (!currentUser) redirect('/login')

  const { unreadCount } = await getCurrentUserNotifications()

  const firstName = currentUser.full_name.split(' ')[0]
  const sent = params.sent === '1'

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-lg space-y-6">
        <TopBar
          title="אימוני כושר"
          subtitle="הזמינו את כולם לאימון משותף"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-10 shadow-sm">
          <div className="flex flex-col items-center gap-8">

            {sent && (
              <div className="rounded-2xl border border-[#c8d8a8] bg-[#f4f8ee] px-6 py-4 text-center text-sm font-medium text-[#4a6b3a]">
                ההזמנה נשלחה! 💪
              </div>
            )}

            <p className="text-center text-sm text-[#6c7664]">
              לחצו כדי לשלוח התראה לכולם
            </p>

            {/* Big round button */}
            <form action="/api/fitness" method="POST">
              <button
                type="submit"
                className="flex h-52 w-52 flex-col items-center justify-center rounded-full bg-[#2f3a2c] shadow-[0_8px_32px_rgba(47,58,44,0.3)] transition-all duration-200 hover:bg-[#232b20] active:scale-95"
              >
                <div className="absolute inset-0 m-auto h-[calc(100%-24px)] w-[calc(100%-24px)] rounded-full border-4 border-white/20" style={{position:'relative', inset:'unset', height:'calc(100% - 24px)', width:'calc(100% - 24px)'}} />
                <div className="text-5xl">💪</div>
                <div className="mt-3 text-center text-base font-bold leading-snug text-white">
                  {firstName} מתחיל/ה<br />אימון
                </div>
              </button>
            </form>

            <p className="text-center text-xs text-[#a0a89a]">
              ישלח התראה לכל בני המשפחה
            </p>
          </div>
        </section>

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
