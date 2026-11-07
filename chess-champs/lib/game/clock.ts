import type { GameRow } from './types'

/** Time left for the side to move. Clocks only run once both players have moved. */
export function liveClocks(g: GameRow, now = Date.now()) {
  const ply = g.moves.length
  const elapsed = ply >= 2 ? now - new Date(g.last_move_at).getTime() : 0
  const white = g.white_clock_ms - (ply % 2 === 0 ? elapsed : 0)
  const black = g.black_clock_ms - (ply % 2 === 1 ? elapsed : 0)
  return { white, black }
}

