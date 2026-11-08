import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Brand from './Brand'
import NavLinks from './NavLinks'
import LogoutButton from './LogoutButton'
import Flag from './Flag'

export default async function Header() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  const [{ data: me }, { data: admin }] = await Promise.all([
    uid ? supabase.from('profiles').select('username, country').eq('id', uid).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc('is_admin'),
  ])
  return (
    <header className="top">
      <div className="top-left">
        <Brand />
        <NavLinks admin={!!admin} />
      </div>
      {me && (
        <div className="who">
          <Link href={`/players/${me.username}`} className="me-link">
            <Flag code={me.country} />
            {me.username}
          </Link>
          <LogoutButton />
        </div>
      )}
    </header>
  )
}
