'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Chessboard } from 'react-chessboard'
import { makeFen } from 'chessops/fen'
import { makeSquare, makeUci, parseSquare } from 'chessops/util'
import { normalizeMove } from 'chessops/chess'
import type { Role } from 'chessops/types'
import { createClient } from '@/lib/supabase/client'
import { replay } from '@/lib/game/engine'
import { liveClocks } from '@/lib/game/clock'
import { VARIANT_LABEL, tcLabel } from '@/lib/game/config'
import type { GameRow } from '@/lib/game/types'

type Player = { id: string; username: string }
type Props = { initial: GameRow; serverNow: number; myId: string; white: Player; black: Player }

const GLYPH: Record<string, string> = { queen: '♕', rook: '♖', bishop: '♗', knight: '♘', king: '♔' }
const DOT = 'radial-gradient(rgba(52,81,110,.5) 24%, transparent 26%)'
const RING = 'radial-gradient(transparent 0%, transparent 79%, rgba(52,81,110,.5) 80%)'

function fmt(ms: number) {
  if (ms <= 0) return '0:00'
  if (ms < 10_000) return (ms / 1000).toFixed(1)
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const REASON: Record<string, string> = {
  checkmate: 'checkmate',
  timeout: 'time',
  resignation: 'resignation',
  stalemate: 'stalemate',
  insufficient: 'insufficient material',
  'fifty-move': 'the fifty-move rule',
  repetition: 'repetition',
}

export default function GameClient({ initial, serverNow, myId, white, black }: Props) {
  const [game, setGame] = useState(initial)
  const [now, setNow] = useState(serverNow)
  const [selected, setSelected] = useState<string | null>(null)
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)
  const offset = useRef(serverNow - Date.now())
  const flagged = useRef(-1)

  const myColor = myId === white.id ? 'white' : myId === black.id ? 'black' : null
  const orientation = myColor ?? 'white'
  const active = game.status === 'active'
  const ply = game.moves.length
  const turn = ply % 2 === 0 ? 'white' : 'black'
  const canMove = active && myColor === turn && !busy

  const { pos } = useMemo(() => replay(game.variant, game.start_fen, game.moves), [game.variant, game.start_fen, game.moves])

  const merge = (next: GameRow) => setGame((prev) => (next.moves.length >= prev.moves.length ? next : prev))

  // Live updates, with a slow poll as a fallback. The poll also asks the server to check the clock.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`game-${game.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, (p) => merge(p.new as GameRow))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id])

  async function tick() {
    try {
      const res = await fetch(`/api/games/${game.id}/tick`, { method: 'POST' })
      const body = await res.json()
      if (body.now) offset.current = body.now - Date.now()
      if (body.game) merge(body.game)
    } catch {}
  }

  useEffect(() => {
    if (!active) return
    const a = setInterval(() => setNow(Date.now() + offset.current), 100)
    const b = setInterval(tick, 4000)
    return () => { clearInterval(a); clearInterval(b) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, game.id])

  const clocks = liveClocks(game, now)
  useEffect(() => {
    if (!active || ply < 2 || flagged.current === ply) return
    if ((turn === 'white' ? clocks.white : clocks.black) <= 0) {
      flagged.current = ply
      tick()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  const dests = useMemo(() => {
    const out = new Map<string, Set<string>>()
    if (!canMove) return out
    for (const [from, to] of pos.allDests()) {
      const set = new Set<string>()
      const piece = pos.board.get(from)
      for (const sq of to) {
        set.add(makeSquare(sq))
        const target = pos.board.get(sq)
        if (piece?.role === 'king' && target?.role === 'rook' && target.color === piece.color) {
          set.add(makeSquare((sq & ~7) | ((sq & 7) > (from & 7) ? 6 : 2)))
        }
      }
      out.set(makeSquare(from), set)
    }
    return out
  }, [pos, canMove])

  async function send(uci: string) {
    const prev = game
    const at = Date.now() + offset.current
    const c = liveClocks(prev, at)
    const inc = ply >= 2 ? prev.increment_ms : 0
    setBusy(true)
    setSelected(null)
    setPromo(null)
    setError('')
    setGame({
      ...prev,
      moves: [...prev.moves, uci],
      last_move_at: new Date(at).toISOString(),
      white_clock_ms: turn === 'white' ? c.white + inc : prev.white_clock_ms,
      black_clock_ms: turn === 'black' ? c.black + inc : prev.black_clock_ms,
    })
    try {
      const res = await fetch(`/api/games/${prev.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uci }),
      })
      const body = await res.json()
      if (body.game) setGame(body.game)
      else if (!res.ok) setGame(prev)
      if (!res.ok && body.error) setError(body.error)
    } catch {
      setGame(prev)
      setError('Connection lost. Try that move again.')
    } finally {
      setBusy(false)
    }
  }

  function attempt(from: string, to: string) {
    if (!canMove || !dests.get(from)?.has(to)) return false
    const f = parseSquare(from)!, t = parseSquare(to)!
    const piece = pos.board.get(f)
    if (piece?.role === 'pawn' && (t >> 3 === 0 || t >> 3 === 7)) {
      setPromo({ from: f, to: t })
      return false
    }
    send(makeUci(normalizeMove(pos, { from: f, to: t })))
    return true
  }

  const mine = (pieceType: string) => (myColor === 'white' ? pieceType[0] === 'w' : pieceType[0] === 'b')

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {}
    const last = game.moves[game.moves.length - 1]
    if (last) for (const sq of [last.slice(0, 2), last.slice(2, 4)]) s[sq] = { backgroundColor: 'rgba(52,81,110,.28)' }
    if (selected) {
      s[selected] = { backgroundColor: 'rgba(52,81,110,.45)' }
      for (const sq of dests.get(selected) ?? []) {
        const occupied = pos.board.has(parseSquare(sq)!)
        s[sq] = { ...s[sq], backgroundImage: occupied ? RING : DOT }
      }
    }
    return s
  }, [game.moves, selected, dests, pos])

  const roles: Role[] = ['queen', 'rook', 'bishop', 'knight', ...(game.variant === 'antichess' ? (['king'] as Role[]) : [])]

  const checks = (color: 'white' | 'black') => {
    const rc = (pos as unknown as { remainingChecks?: Record<string, number> }).remainingChecks
    return game.variant === 'threecheck' && rc ? `${3 - rc[color]}/3 checks` : ''
  }

  const bar = (color: 'white' | 'black') => {
    const p = color === 'white' ? white : black
    const ms = color === 'white' ? clocks.white : clocks.black
    const running = active && ply >= 2 && turn === color
    const shown = active ? ms : color === 'white' ? game.white_clock_ms : game.black_clock_ms
    return (
      <div className="player">
        <div className="name">
          {p.username}
          {p.id === myId && <small>you</small>}
          {checks(color) && <small>{checks(color)}</small>}
        </div>
        <div className={`clock${running ? ' on' : ''}${shown < 10_000 ? ' low' : ''}`}>{fmt(shown)}</div>
      </div>
    )
  }

  const top = orientation === 'white' ? 'black' : 'white'
  const bottom = orientation

  let result: { title: string; sub: string } | null = null
  if (!active) {
    const t = game.termination ?? ''
    const reason =
      REASON[t] ??
      ({ atomic: 'king exploded', kingofthehill: 'king reached the center', threecheck: 'third check', antichess: 'antichess rules' } as Record<string, string>)[
        game.variant === 'standard' || game.variant === 'chess960' ? '' : game.variant
      ] ??
      ''
    const winnerName = game.result === 'white' ? white.username : game.result === 'black' ? black.username : ''
    const title =
      t === 'aborted' ? 'Game aborted'
      : game.result === 'draw' ? 'Draw'
      : myColor ? (game.result === myColor ? 'You won' : 'You lost')
      : `${winnerName} won`
    const before = myColor === 'white' ? game.white_rating_before : game.black_rating_before
    const after = myColor === 'white' ? game.white_rating_after : game.black_rating_after
    const delta = before != null && after != null ? Math.round(after) - Math.round(before) : null
    const parts = [reason && t !== 'aborted' ? `By ${reason}` : '', delta != null ? `Rating ${Math.round(before!)} → ${Math.round(after!)} (${delta >= 0 ? '+' : ''}${delta})` : ''].filter(Boolean)
    result = { title, sub: parts.join('. ') }
  }

  return (
    <>
      <header className="top">
        <Link href="/" style={{ color: 'inherit', fontWeight: 600 }}>Chess Champs</Link>
      </header>
      <div className="game">
        <div className="game-meta">
          <span>{VARIANT_LABEL[game.variant]}, {tcLabel(game.initial_ms, game.increment_ms)}</span>
          <span>{active && ply < 2 ? 'Clocks start after both players move' : ''}</span>
        </div>
        {bar(top)}
        <div className="board-frame">
          <Chessboard
            options={{
              id: game.id,
              position: makeFen(pos.toSetup()).split(' ')[0],
              boardOrientation: orientation,
              allowDragging: canMove,
              canDragPiece: ({ piece }) => canMove && mine(piece.pieceType),
              onPieceDrag: ({ square }) => { if (square) setSelected(square) },
              onPieceDragCancel: () => setSelected(null),
              onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? attempt(sourceSquare, targetSquare) : false),
              onSquareClick: ({ piece, square }) => {
                if (selected && dests.get(selected)?.has(square)) attempt(selected, square)
                else if (canMove && piece && mine(piece.pieceType)) setSelected(square)
                else setSelected(null)
              },
              squareStyles,
              lightSquareStyle: { backgroundColor: 'var(--board-l)' },
              darkSquareStyle: { backgroundColor: 'var(--board-d)' },
              animationDurationInMs: 150,
              allowDrawingArrows: false,
            }}
          />
          {promo && (
            <div className="promo">
              <div className="row">
                {roles.map((r) => (
                  <button
                    key={r}
                    aria-label={`Promote to ${r}`}
                    onClick={() => send(makeUci({ from: promo.from, to: promo.to, promotion: r }))}
                  >
                    {GLYPH[r]}
                  </button>
                ))}
                <button aria-label="Cancel" onClick={() => setPromo(null)}>×</button>
              </div>
            </div>
          )}
        </div>
        {bar(bottom)}
        {error && <p className="error" role="alert">{error}</p>}
        {result ? (
          <div className="result">
            <strong>{result.title}</strong>
            {result.sub && <span>{result.sub}</span>}
            <div className="actions" style={{ marginTop: 8 }}>
              <Link className="btn ghost small" href="/">Back to lobby</Link>
            </div>
          </div>
        ) : myColor ? (
          <div className="actions">
            {confirmResign ? (
              <div className="row">
                <button className="btn danger small" onClick={() => { setConfirmResign(false); fetch(`/api/games/${game.id}/resign`, { method: 'POST' }).then((r) => r.json()).then((b) => b.game && merge(b.game)) }}>
                  {ply < 2 ? 'Abort game' : 'Resign'}
                </button>
                <button className="btn ghost small" onClick={() => setConfirmResign(false)}>Keep playing</button>
              </div>
            ) : (
              <button className="btn ghost small" onClick={() => setConfirmResign(true)}>{ply < 2 ? 'Abort' : 'Resign'}</button>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}
