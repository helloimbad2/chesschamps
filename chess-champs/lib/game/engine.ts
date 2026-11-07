import { parseFen, makeFen } from 'chessops/fen'
import { parseUci, makeUci } from 'chessops/util'
import { setupPosition, defaultPosition } from 'chessops/variant'
import { normalizeMove } from 'chessops/chess'
import type { Rules, Color } from 'chessops/types'
import type { Position } from 'chessops/chess'
import type { Variant } from './config'

export const RULES: Record<Variant, Rules> = {
  standard: 'chess',
  chess960: 'chess',
  threecheck: '3check',
  atomic: 'atomic',
  antichess: 'antichess',
  kingofthehill: 'kingofthehill',
}

export function random960Fen(): string {
  const r: string[] = Array(8).fill('')
  const free = () => r.flatMap((v, i) => (v ? [] : [i]))
  const pick = (a: number[]) => a[Math.floor(Math.random() * a.length)]
  r[pick([0, 2, 4, 6])] = 'b'
  r[pick([1, 3, 5, 7])] = 'b'
  r[pick(free())] = 'q'
  r[pick(free())] = 'n'
  r[pick(free())] = 'n'
  const [a, b, c] = free()
  r[a] = 'r'; r[b] = 'k'; r[c] = 'r'
  const back = r.join('')
  return `${back}/pppppppp/8/8/8/8/PPPPPPPP/${back.toUpperCase()} w KQkq - 0 1`
}

export function startFen(variant: Variant): string {
  if (variant === 'chess960') return random960Fen()
  return makeFen(defaultPosition(RULES[variant]).toSetup())
}

export function positionFromFen(variant: Variant, fen: string): Position {
  const setup = parseFen(fen).unwrap()
  return setupPosition(RULES[variant], setup).unwrap()
}

const key = (pos: Position) => makeFen(pos.toSetup()).split(' ').slice(0, 4).join(' ')

export type Outcome = { winner: Color | undefined; termination: string } | null

export function outcomeOf(pos: Position, seen: Map<string, number>): Outcome {
  const o = pos.outcome()
  if (o) {
    const termination = pos.isCheckmate() ? 'checkmate' : pos.isStalemate() && !o.winner ? 'stalemate' : pos.isInsufficientMaterial() ? 'insufficient' : 'variant'
    return { winner: o.winner, termination }
  }
  if (pos.halfmoves >= 100) return { winner: undefined, termination: 'fifty-move' }
  if ((seen.get(key(pos)) ?? 0) >= 3) return { winner: undefined, termination: 'repetition' }
  return null
}

/** Replays the game from its start position. Throws if a stored move is illegal. */
export function replay(variant: Variant, fen: string, moves: string[]) {
  const pos = positionFromFen(variant, fen)
  const seen = new Map<string, number>([[key(pos), 1]])
  for (const uci of moves) {
    const m = parseUci(uci)
    if (!m || !pos.isLegal(m)) throw new Error('illegal stored move')
    pos.play(m)
    seen.set(key(pos), (seen.get(key(pos)) ?? 0) + 1)
  }
  return { pos, seen }
}

export function tryMove(pos: Position, seen: Map<string, number>, uci: string) {
  const m = parseUci(uci)
  if (!m || !pos.isLegal(m)) return null
  const canonical = makeUci(normalizeMove(pos, m))
  pos.play(m)
  seen.set(key(pos), (seen.get(key(pos)) ?? 0) + 1)
  return { uci: canonical, outcome: outcomeOf(pos, seen) }
}
