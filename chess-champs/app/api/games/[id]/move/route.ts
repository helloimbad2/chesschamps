import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finishGame, liveClocks, loadGame, settleClock } from '@/lib/game/server'
import { replay, tryMove } from '@/lib/game/engine'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { uci } = await req.json().catch(() => ({}))
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })

  const admin = createAdminClient()
  const g = await loadGame(admin, id)
  if (!g) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  if (g.status !== 'active') return NextResponse.json({ error: 'The game is over.', game: g }, { status: 409 })

  const ply = g.moves.length
  const mover = ply % 2 === 0 ? g.white_id : g.black_id
  if (auth.user.id !== mover) return NextResponse.json({ error: 'Not your turn.', game: g }, { status: 409 })

  const timedOut = await settleClock(admin, g)
  if (timedOut) return NextResponse.json({ error: 'Out of time.', game: timedOut }, { status: 409 })

  let played
  try {
    const { pos, seen } = replay(g.variant, g.start_fen, g.moves)
    played = typeof uci === 'string' ? tryMove(pos, seen, uci) : null
  } catch {
    return NextResponse.json({ error: 'Could not read the game state.', game: g }, { status: 500 })
  }
  if (!played) return NextResponse.json({ error: 'Illegal move.', game: g }, { status: 400 })

  const now = Date.now()
  const left = liveClocks(g, now)
  const patch = {
    moves: [...g.moves, played.uci],
    move_count: ply + 1,
    white_clock_ms: Math.round(ply % 2 === 0 ? left.white + g.increment_ms : g.white_clock_ms),
    black_clock_ms: Math.round(ply % 2 === 1 ? left.black + g.increment_ms : g.black_clock_ms),
    last_move_at: new Date(now).toISOString(),
  }

  if (played.outcome) {
    const { winner, termination } = played.outcome
    const done = await finishGame(admin, g, winner ?? 'draw', termination, patch)
    return NextResponse.json({ game: done ?? (await loadGame(admin, id)) })
  }

  const { data } = await admin
    .from('games')
    .update(patch)
    .eq('id', id)
    .eq('status', 'active')
    .eq('move_count', ply)
    .select()
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'That move did not go through.', game: await loadGame(admin, id) }, { status: 409 })
  return NextResponse.json({ game: data })
}
