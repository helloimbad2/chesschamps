import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finishGame, loadGame } from '@/lib/game/server'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  const admin = createAdminClient()
  const g = await loadGame(admin, id)
  if (!g || g.status !== 'active') return NextResponse.json({ game: g })
  const uid = auth.user.id
  if (uid !== g.white_id && uid !== g.black_id) return NextResponse.json({ error: 'Not your game.' }, { status: 403 })
  // Resigning before both sides have moved aborts the game without a rating change.
  const done =
    g.moves.length < 2
      ? await finishGame(admin, g, null, 'aborted')
      : await finishGame(admin, g, uid === g.white_id ? 'black' : 'white', 'resignation')
  return NextResponse.json({ game: done ?? (await loadGame(admin, id)) })
}
