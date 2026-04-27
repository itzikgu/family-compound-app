'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signup(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!fullName || !email || password.length < 6) {
    redirect('/signup?error=invalid-fields')
  }

  const supabase = await createClient()

  // Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError || !authData.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      redirect('/signup?error=already-registered')
    }
    redirect('/signup?error=signup-failed')
  }

  // Insert into family_members so the rest of the app recognises this user
  await supabase.from('family_members').insert({
    full_name: fullName,
    email,
  })

  redirect('/')
}
