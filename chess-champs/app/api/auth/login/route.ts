import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { countryFromHeaders } from '@/lib/country'

const fail = (message: string, status = 401) => NextResponse.json({ error: message }, { status })

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}))
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return fail('Enter your username and password.', 400)
  }

  const admin = createAdminClient()
  const escaped = username.trim().replace(/[\\%_]/g, '\\$&')
  const { data: profile } = await admin.from('profiles').select('id').ilike('username', escaped).maybeSingle()
  const { data: found } = profile ? await admin.auth.admin.getUserById(profile.id) : { data: null }
  const email = found?.user?.email
  if (!email) return fail('Wrong username or password.')

  const supabase = await createClient()
  const { data: session, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.code === 'email_not_confirmed') return fail('Confirm your email first, then log in.', 403)
    return fail('Wrong username or password.')
  }
  const country = countryFromHeaders(req.headers)
  if (country && session.user) await admin.from('profiles').update({ country }).eq('id', session.user.id)
  return NextResponse.json({ ok: true })
}
