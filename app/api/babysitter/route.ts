import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 })
  }

  const { data: familyMember } = await supabase
    .from('family_members')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!familyMember) {
    return NextResponse.json({ error: 'not-authenticated' }, { status: 401 })
  }

  const formData = await request.formData()
  const action = String(formData.get('action') ?? '')

  if (action === 'start') {
    const babysitterId = String(formData.get('babysitter_id') ?? '')
    const hourlyRate = parseFloat(String(formData.get('hourly_rate') ?? '30'))

    if (!babysitterId) {
      return NextResponse.json({ error: 'missing-babysitter' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('babysitter_sessions')
      .insert({
        babysitter_id: babysitterId,
        hourly_rate: isNaN(hourlyRate) ? 30 : hourlyRate,
        started_at: new Date().toISOString(),
        created_by: familyMember.id,
      })
      .select('id, babysitter_id, started_at, hourly_rate')
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'insert-failed' }, { status: 500 })
    }

    return NextResponse.json({ session })
  }

  if (action === 'stop') {
    const sessionId = String(formData.get('session_id') ?? '')

    if (!sessionId) {
      return NextResponse.json({ error: 'missing-session' }, { status: 400 })
    }

    const endedAt = new Date().toISOString()

    const { data: session } = await supabase
      .from('babysitter_sessions')
      .select('started_at, hourly_rate')
      .eq('id', sessionId)
      .single()

    let durationMinutes = 0
    if (session) {
      const ms = new Date(endedAt).getTime() - new Date(session.started_at).getTime()
      durationMinutes = Math.round(ms / 60000)
    }

    await supabase
      .from('babysitter_sessions')
      .update({ ended_at: endedAt, duration_minutes: durationMinutes })
      .eq('id', sessionId)

    return NextResponse.json({ ok: true, durationMinutes })
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 })
}
