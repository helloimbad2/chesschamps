import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

const UNKNOWN = new Set(['XX', 'T1'])

/** Country of the connection, as reported by the host (Vercel, or Cloudflare in front of it). */
export function countryFromHeaders(h: Headers): string | null {
  const c = (h.get('x-vercel-ip-country') ?? h.get('cf-ipcountry') ?? '').toUpperCase()
  return /^[A-Z]{2}$/.test(c) && !UNKNOWN.has(c) ? c : null
}

/** Keeps a player's stored country in step with where they are connecting from. */
export async function syncCountry(uid: string, current: string | null) {
  const c = countryFromHeaders(await headers())
  if (!c || c === current) return c ?? current
  await createAdminClient().from('profiles').update({ country: c }).eq('id', uid)
  return c
}
