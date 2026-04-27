'use client'

/**
 * BabysitterTimer
 *
 * Pango-style start/stop button with a live timer.
 * The server page passes the currently-active session (if any) and the
 * list of family members so the user can pick who's babysitting.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; full_name: string }

type ActiveSession = {
  id: string
  babysitter_id: string
  started_at: string
  hourly_rate: number
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatCost(seconds: number, hourlyRate: number) {
  const cost = (seconds / 3600) * hourlyRate
  return `₪${cost.toFixed(2).replace(/\.00$/, '')}`
}

export default function BabysitterTimer({
  members,
  initialSession,
}: {
  members: Member[]
  initialSession: ActiveSession | null
}) {
  const router = useRouter()

  const [session, setSession] = useState<ActiveSession | null>(initialSession)
  const [elapsed, setElapsed] = useState(0)
  const [selectedMember, setSelectedMember] = useState(members[0]?.id ?? '')
  const [hourlyRate, setHourlyRate] = useState('30')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live timer — ticks every second while a session is active
  useEffect(() => {
    if (!session) {
      setElapsed(0)
      return
    }
    const startMs = new Date(session.started_at).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session])

  const babysitterName = session
    ? (members.find((m) => m.id === session.babysitter_id)?.full_name ?? '—')
    : null

  const handleStart = useCallback(async () => {
    if (!selectedMember) return
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('action', 'start')
    form.append('babysitter_id', selectedMember)
    form.append('hourly_rate', hourlyRate)

    try {
      const res = await fetch('/api/babysitter', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.session) {
        setError('שגיאה בהפעלת הטיימר. נסו שוב.')
        return
      }
      setSession(data.session)
    } catch {
      setError('שגיאת רשת. נסו שוב.')
    } finally {
      setLoading(false)
    }
  }, [selectedMember, hourlyRate])

  const handleStop = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('action', 'stop')
    form.append('session_id', session.id)

    try {
      await fetch('/api/babysitter', { method: 'POST', body: form })
      setSession(null)
      setElapsed(0)
      router.refresh() // re-fetch server data to show updated history
    } catch {
      setError('שגיאת רשת. נסו שוב.')
    } finally {
      setLoading(false)
    }
  }, [session, router])

  const rate = parseFloat(hourlyRate) || 30

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Timer display */}
      {session && (
        <div className="text-center">
          <div className="text-6xl font-mono font-bold tabular-nums text-[#2f3a2c]">
            {formatElapsed(elapsed)}
          </div>
          <div className="mt-2 text-sm text-[#6c7664]">
            שומר/ת: <span className="font-semibold text-[#384332]">{babysitterName}</span>
          </div>
          <div className="mt-1 text-lg font-semibold text-[#a67c52]">
            {formatCost(elapsed, session.hourly_rate)}
          </div>
        </div>
      )}

      {/* Big round button */}
      <button
        onClick={session ? handleStop : handleStart}
        disabled={loading}
        className={`
          relative flex h-52 w-52 flex-col items-center justify-center rounded-full
          shadow-[0_8px_32px_rgba(0,0,0,0.18)] transition-all duration-200
          active:scale-95 disabled:opacity-60
          ${session
            ? 'bg-[#c0392b] hover:bg-[#a93226] shadow-[#c0392b]/30'
            : 'bg-[#2f3a2c] hover:bg-[#232b20] shadow-[#2f3a2c]/30'
          }
        `}
      >
        {/* Outer ring */}
        <div className={`
          absolute inset-3 rounded-full border-4 opacity-30
          ${session ? 'border-white' : 'border-[#a8c890]'}
        `} />

        {session ? (
          <>
            <div className="text-4xl">⏹</div>
            <div className="mt-2 text-lg font-bold text-white">עצור</div>
          </>
        ) : (
          <>
            <div className="text-4xl">▶</div>
            <div className="mt-2 text-lg font-bold text-white">התחל שמירה</div>
          </>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        )}
      </button>

      {/* Settings — only shown when idle */}
      {!session && (
        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#384332]">
              מי השומר/ת?
            </label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#384332]">
              תעריף לשעה (₪)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
              placeholder="30"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
