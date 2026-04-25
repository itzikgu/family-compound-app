import { login } from './actions'

function getErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case 'login-failed':
      return 'האימייל או הסיסמה אינם תקינים.'
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f8f5ed] to-[#f2eee4] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-[32px] border border-[#d8d1c2] bg-[#fffdf8] p-7 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
          <div className="mb-6 text-center">
            <div className="mb-3 text-4xl">🌿</div>
            <h1 className="text-3xl font-bold text-[#2f3a2c]">כניסה למערכת</h1>
            <p className="mt-2 text-sm text-[#6c7664]">
              התחברו כדי לנהל את המשק המשפחתי
            </p>
          </div>

          {errorMessage && (
            <p className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              {errorMessage}
            </p>
          )}

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
        </div>
      </div>
    </main>
  )
}