import type { SupabaseClient } from '@supabase/supabase-js'
import { update } from './glicko2'
import { FIRST_MOVE_GRACE_MS } from './config'
import { replay } from './engine'
import { liveClocks } from './clock'
import type { GameRow } from './types'

export type { GameRow }
export { liveClocks }

export async function loadGame(admin: SupabaseClient, id: string) {
  const { data } = await admin.from('games').select('*').eq('id', id).maybeSingle()
  return data as GameRow | null
}

/** Ends an active game exactly once and applies Glicko-2 updates. Returns the finished row, or null if someone else ended it first. */
export async function finishGame(
  admin: SupabaseClient,
  g: GameRow,
  result: 'white' | 'black' | 'draw' | null,
  termination: string,
  patch: Partial<GameRow> = {}
) {
  const base = { status: 'finished', result, termination, ...patch }

  if (result === null) {
    const { data } = await admin.from('games').update(base).eq('id', g.id).eq('status', 'active').select().maybeSingle()
    return data as GameRow | null
  }

  const { data: ps } = await admin.from('profiles').select('id, rating, rd, vol, games_played').in('id', [g.white_id, g.black_id])
  const w = ps?.find((p) => p.id === g.white_id)
  const b = ps?.find((p) => p.id === g.black_id)
  if (!w || !b) return null

  const sw = result === 'white' ? 1 : result === 'draw' ? 0.5 : 0
  const nw = update(w, b, sw)
  const nb = update(b, w, 1 - sw)

  const { data } = await admin
    .from('games')
    .update({
      ...base,
      white_rating_before: w.rating,
      black_rating_before: b.rating,
      white_rating_after: nw.rating,
      black_rating_after: nb.rating,
    })
    .eq('id', g.id)
    .eq('status', 'active')
    .select()
    .maybeSingle()
  if (!data) return null

  await Promise.all([
    admin.from('profiles').update({ rating: nw.rating, rd: nw.rd, vol: nw.vol, games_played: w.games_played + 1 }).eq('id', w.id),
    admin.from('profiles').update({ rating: nb.rating, rd: nb.rd, vol: nb.vol, games_played: b.games_played + 1 }).eq('id', b.id),
  ])
  return data as GameRow
}

/** Applies a timeout or abort if one is due. Returns the finished game, or null if nothing is due. */
export async function settleClock(admin: SupabaseClient, g: GameRow) {
  if (g.status !== 'active') return null
  const now = Date.now()
  const ply = g.moves.length

  // Nobody moved in time to get the game going: abort without a rating change.
  if (ply < 2 && now - new Date(g.last_move_at).getTime() > FIRST_MOVE_GRACE_MS) {
    return finishGame(admin, g, null, 'aborted')
  }
  const { white, black } = liveClocks(g, now)
  const mover = ply % 2 === 0 ? 'white' : 'black'
  const left = mover === 'white' ? white : black
  if (left > 0) return null

  const { pos } = replay(g.variant, g.start_fen, g.moves)
  const winner = mover === 'white' ? 'black' : 'white'
  const insufficient = pos.hasInsufficientMaterial(winner)
  return finishGame(admin, g, insufficient ? 'draw' : winner, 'timeout', mover === 'white' ? { white_clock_ms: 0 } : { black_clock_ms: 0 })
}
