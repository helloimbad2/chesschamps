import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIME_CONTROLS, VARIANTS } from '@/lib/game/config'
import { startFen } from '@/lib/game/engine'

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

async function activeGameId(admin: ReturnType<typeof createAdminClient>, uid: string) {
  const { data } = await admin
    .from('games')
    .select('id')
    .eq('status', 'active')
    .or(`white_id.eq.${uid},black_id.eq.${uid}`)
    .limit(1)
    .maybeSingle()
  return data?.id as string | undefined
}

async function user() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

// Status poll. Doubles as the queue heartbeat.
export async function GET() {
  const u = await user()
  if (!u) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  const admin = createAdminClient()
  const gameId = await activeGameId(admin, u.id)
  if (gameId) return NextResponse.json({ gameId })
  const { data } = await admin.from('queue').update({ last_seen: new Date().toISOString() }).eq('user_id', u.id).select('user_id')
  return NextResponse.json({ queued: !!data?.length })
}

export async function POST() {
  const u = await user()
  if (!u) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  const admin = createAdminClient()

  const { data: state } = await admin.from('app_state').select('phase').eq('id', 1).single()
  if (state?.phase !== 'qualifiers') return NextResponse.json({ error: 'Qualifiers have ended.' }, { status: 409 })

  const existing = await activeGameId(admin, u.id)
  if (existing) return NextResponse.json({ gameId: existing })

  await admin.from('queue').upsert({ user_id: u.id, last_seen: new Date().toISOString() })
  const { data: opp } = await admin.rpc('claim_opponent', { p_user: u.id })
  if (!opp) return NextResponse.json({ queued: true })

  const variant = pick(VARIANTS)
  const tc = pick(TIME_CONTROLS)
  const [white, black] = Math.random() < 0.5 ? [u.id, opp as string] : [opp as string, u.id]
  const initial = tc.minutes * 60_000
  const { data: game, error } = await admin
    .from('games')
    .insert({
      white_id: white,
      black_id: black,
      variant,
      initial_ms: initial,
      increment_ms: tc.inc * 1000,
      start_fen: startFen(variant),
      white_clock_ms: initial,
      black_clock_ms: initial,
    })
    .select('id')
    .single()
  if (error || !game) return NextResponse.json({ error: 'Could not start the game.' }, { status: 500 })
  return NextResponse.json({ gameId: game.id })
}

export async function DELETE() {
  const u = await user()
  if (!u) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  await createAdminClient().from('queue').delete().eq('user_id', u.id)
  return NextResponse.json({ ok: true })
}
