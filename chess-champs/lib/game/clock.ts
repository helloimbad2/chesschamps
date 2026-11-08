import type { GameRow } from './types'

/**
 * A player's clock starts the moment they have loaded the game (ready_at) or, once the
 * game is under way, the moment their opponent moves. A player who has not loaded yet
 * has a paused clock.
 */
function runningSince(g: GameRow): number {
  const ply = g.moves.length
  const last = new Date(g.last_move_at).getTime()
  if (ply >= 2) return last
  const ready = ply === 0 ? g.white_ready_at : g.black_ready_at
  return ready ? Math.max(last, new Date(ready).getTime()) : Infinity
}

export function liveClocks(g: GameRow, now = Date.now()) {
  const elapsed = Math.max(0, now - runningSince(g))
  const whiteToMove = g.moves.length % 2 === 0
  return {
    white: g.white_clock_ms - (whiteToMove ? elapsed : 0),
    black: g.black_clock_ms - (whiteToMove ? 0 : elapsed),
  }
}

export const clockRunning = (g: GameRow, now = Date.now()) => g.status === 'active' && runningSince(g) <= now
