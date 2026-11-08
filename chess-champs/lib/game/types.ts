import type { Variant } from './config'

export type GameRow = {
  id: string
  white_id: string
  black_id: string
  variant: Variant
  initial_ms: number
  increment_ms: number
  start_fen: string
  moves: string[]
  status: 'active' | 'finished'
  result: 'white' | 'black' | 'draw' | null
  termination: string | null
  white_clock_ms: number
  black_clock_ms: number
  last_move_at: string
  move_count: number
  white_ready_at: string | null
  black_ready_at: string | null
  white_rating_before: number | null
  black_rating_before: number | null
  white_rating_after: number | null
  black_rating_after: number | null
}

