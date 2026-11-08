import { parseUci } from 'chessops/util'
import { makeSan } from 'chessops/san'
import { positionFromFen } from './engine'
import type { Variant } from './config'

/** Standard algebraic notation for each stored move. Falls back to the raw move if anything is off. */
export function toSan(variant: Variant, fen: string, moves: string[]): string[] {
  const out: string[] = []
  try {
    const pos = positionFromFen(variant, fen)
    for (const uci of moves) {
      const m = parseUci(uci)
      if (!m || !pos.isLegal(m)) { out.push(uci); continue }
      out.push(makeSan(pos, m))
      pos.play(m)
    }
  } catch {
    return moves
  }
  return out
}
