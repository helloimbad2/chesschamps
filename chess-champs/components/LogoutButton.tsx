'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  return (
    <button
      className="btn ghost small"
      onClick={async () => {
        await createClient().auth.signOut()
        router.replace('/login')
        router.refresh()
      }}
    >
      Log out
    </button>
  )
}
