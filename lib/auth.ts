import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedFamilyMember() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return null
  }

  const { data: familyMember, error: memberError } = await supabase
    .from('family_members')
    .select('id, full_name, email')
    .eq('email', user.email)
    .single()

  if (memberError || !familyMember) {
    return null
  }

  return familyMember
}