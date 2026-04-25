'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const FAMILY_PASSWORD = '123456'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '')

  if (!email) {
    redirect('/login?error=login-failed')
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: FAMILY_PASSWORD,
  })

  if (error) {
    redirect('/login?error=login-failed')
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
