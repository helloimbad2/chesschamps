import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadGame } from '@/lib/game/server'

// Called when a player opens the game. Their clock starts from here.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  const admin = createAdminClient()
  const g = await loadGame(admin, id)
  if (!g) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })

  const column = auth.user.id === g.white_id ? 'white_ready_at' : auth.user.id === g.black_id ? 'black_ready_at' : null
  if (g.status === 'active' && column && !g[column]) {
    const { data } = await admin
      .from('games')
      .update({ [column]: new Date().toISOString() })
      .eq('id', id)
      .is(column, null)
      .select()
      .maybeSingle()
    return NextResponse.json({ game: data ?? (await loadGame(admin, id)), now: Date.now() })
  }
  return NextResponse.json({ game: g, now: Date.now() })
}
