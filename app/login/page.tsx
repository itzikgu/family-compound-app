import { createClient } from '@/lib/supabase/server'
import { login } from './actions'

function getErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case 'login-failed':
      return 'הכניסה נכשלה. נסו שוב.'
    default:
      return null
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const errorMessage = getErrorMessage(resolvedSearchParams.error)

  // Fetch family members for the name picker.
  // Requires an anon SELECT policy on family_members — see README.
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('family_members')
    .select('id, full_name, email')
    .order('full_name', { ascending: true })

  const safeMembers = members ?? []

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f8f5ed] to-[#f2eee4] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-[32px] border border-[#d8d1c2] bg-[#fffdf8] p-7 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
          <div className="mb-6 text-center">
            <div className="mb-3 text-4xl">🌿</div>
            <h1 className="text-3xl font-bold text-[#2f3a2c]">כניסה למערכת</h1>
            <p className="mt-2 text-sm text-[#6c7664]">
              בחרו את שמכם כדי להיכנס
            </p>
          </div>

          {errorMessage && (
            <p className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          {safeMembers.length === 0 ? (
            /* Fallback: manual email + password if members can't be fetched */
            <form action={login} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  אימייל
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  סיסמה
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-[#2f3a2c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#232b20]"
              >
                כניסה
              </button>
            </form>
          ) : (
            /* Name picker — one tap per family member */
            <div className="grid grid-cols-2 gap-3">
              {safeMembers.map((member) => (
                <form key={member.id} action={login}>
                  <input type="hidden" name="email" value={member.email} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-4 text-center text-sm font-semibold text-[#2f3a2c] transition hover:border-[#6f7f57] hover:bg-[#f4f8ee] active:scale-95"
                  >
                    {member.full_name}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
