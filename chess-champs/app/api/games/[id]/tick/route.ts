import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadGame, settleClock } from '@/lib/game/server'

// Anyone viewing a game can ask the server to check its clock. The server decides.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const g = await loadGame(admin, id)
  if (!g) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  const done = await settleClock(admin, g)
  return NextResponse.json({ game: done ?? g, now: Date.now() })
}
