'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Chessboard } from 'react-chessboard'
import { makeFen } from 'chessops/fen'
import { makeSquare, makeUci, parseSquare } from 'chessops/util'
import { normalizeMove } from 'chessops/chess'
import type { Role } from 'chessops/types'
import { createClient } from '@/lib/supabase/client'
import { positionFromFen, replay } from '@/lib/game/engine'
import { clockRunning, liveClocks } from '@/lib/game/clock'
import { toSan } from '@/lib/game/san'
import { VARIANT_LABEL, tcLabel } from '@/lib/game/config'
import type { GameRow } from '@/lib/game/types'
import Flag from './Flag'

type Player = { id: string; username: string; country?: string | null }
type Props = { initial: GameRow; serverNow: number; myId: string; white: Player; black: Player }

const GLYPH: Record<string, string> = { queen: '♕', rook: '♖', bishop: '♗', knight: '♘', king: '♔' }
const DOT = 'radial-gradient(var(--hl-strong) 22%, transparent 24%)'
const RING = 'radial-gradient(transparent 0%, transparent 76%, var(--hl-strong) 78%)'
const CHECK = 'radial-gradient(circle, rgba(220,38,38,.75) 0%, rgba(220,38,38,.35) 45%, transparent 72%)'

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
const VARIANT_REASON: Record<string, string> = {
  atomic: 'king exploded',
  kingofthehill: 'king reached the center',
  threecheck: 'third check',
  antichess: 'antichess rules',
}

export default function GameClient({ initial, serverNow, myId, white, black }: Props) {
  const [game, setGame] = useState(initial)
  const [now, setNow] = useState(serverNow)
  const [selected, setSelected] = useState<string | null>(null)
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null)
  const offset = useRef(serverNow - Date.now())
  const flagged = useRef(-1)
  const gameRef = useRef(game)
  gameRef.current = game
  const listRef = useRef<HTMLDivElement>(null)

  const myColor = myId === white.id ? 'white' : myId === black.id ? 'black' : null
  const orientation = myColor ?? 'white'
  const active = game.status === 'active'
  const ply = game.moves.length
  const turn = ply % 2 === 0 ? 'white' : 'black'
  const canMove = active && myColor === turn && !busy
  const waiting = active && !!myColor && turn !== myColor

  const { pos } = useMemo(() => {
    try {
      return replay(game.variant, game.start_fen, game.moves)
    } catch {
      return { pos: positionFromFen(game.variant, game.start_fen), seen: new Map<string, number>() }
    }
  }, [game.variant, game.start_fen, game.moves])

  const san = useMemo(() => toSan(game.variant, game.start_fen, game.moves), [game.variant, game.start_fen, game.moves])

  // The server is the only source of truth. Updates from either channel go through here.
  function apply(g?: GameRow, serverTime?: number) {
    if (serverTime) offset.current = serverTime - Date.now()
    if (g) setGame((prev) => (g.moves.length >= prev.moves.length ? g : prev))
  }

  // Marks this player as loaded (which starts their clock) and otherwise asks the server for the latest state.
  async function sync() {
    const g = gameRef.current
    const ready = myColor === 'white' ? g.white_ready_at : myColor === 'black' ? g.black_ready_at : 'n/a'
    try {
      const res = await fetch(`/api/games/${g.id}/${ready ? 'tick' : 'ready'}`, { method: 'POST' })
      const body = await res.json()
      apply(body.game, body.now)
    } catch {}
  }

  useEffect(() => {
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id])

  // Realtime tells us something changed. We then fetch the real state instead of trusting the payload.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`game-${game.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, () => sync())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id])

  useEffect(() => {
    if (!active) return
    const a = setInterval(() => setNow(Date.now() + offset.current), 100)
    const b = setInterval(sync, 2000)
    return () => { clearInterval(a); clearInterval(b) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, game.id])

  const clocks = liveClocks(game, now)
  useEffect(() => {
    if (!active || ply < 1 || flagged.current === ply) return
    if ((turn === 'white' ? clocks.white : clocks.black) <= 0) {
      flagged.current = ply
      sync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [ply])

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

  // One premove: queued while the opponent is thinking, played as soon as it is our turn if it is legal.
  useEffect(() => {
    if (!premove) return
    if (!active || !myColor) return setPremove(null)
    if (!canMove) return
    const { from, to } = premove
    setPremove(null)
    if (dests.get(from)?.has(to)) attempt(from, to, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMove, premove, dests, active])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPremove(null); setSelected(null); setPromo(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function send(uci: string) {
    const prev = gameRef.current
    const at = Date.now() + offset.current
    const left = liveClocks(prev, at)
    setBusy(true)
    setSelected(null)
    setPromo(null)
    setError('')
    setGame({
      ...prev,
      moves: [...prev.moves, uci],
      move_count: prev.move_count + 1,
      last_move_at: new Date(at).toISOString(),
      white_clock_ms: turn === 'white' ? left.white + prev.increment_ms : prev.white_clock_ms,
      black_clock_ms: turn === 'black' ? left.black + prev.increment_ms : prev.black_clock_ms,
    })
    try {
      const res = await fetch(`/api/games/${prev.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uci }),
      })
      const body = await res.json()
      if (res.ok) setGame(body.game)
      else {
        setGame(body.game ?? prev)
        setError(body.error || 'That move did not go through.')
      }
    } catch {
      setGame(prev)
      setError('Connection lost. Try that move again.')
    } finally {
      setBusy(false)
    }
  }

  function attempt(from: string, to: string, auto = false) {
    if (!canMove || !dests.get(from)?.has(to)) return false
    const f = parseSquare(from)!, t = parseSquare(to)!
    const piece = pos.board.get(f)
    if (piece?.role === 'pawn' && (t >> 3 === 0 || t >> 3 === 7)) {
      if (auto) {
        send(makeUci({ from: f, to: t, promotion: 'queen' }))
        return true
      }
      setPromo({ from: f, to: t })
      return false
    }
    send(makeUci(normalizeMove(pos, { from: f, to: t })))
    return true
  }

  const mine = (pieceType: string) => !!myColor && pieceType[0] === (myColor === 'white' ? 'w' : 'b')

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {}
    const last = game.moves[game.moves.length - 1]
    if (last) for (const sq of [last.slice(0, 2), last.slice(2, 4)]) s[sq] = { backgroundColor: 'var(--hl)' }
    if (premove) for (const sq of [premove.from, premove.to]) s[sq] = { backgroundColor: 'var(--pre)' }
    if (active && pos.isCheck()) {
      const k = pos.board.kingOf(pos.turn)
      if (k !== undefined) s[makeSquare(k)] = { ...s[makeSquare(k)], backgroundImage: CHECK }
    }
    if (selected) {
      s[selected] = { backgroundColor: 'var(--hl-strong)' }
      for (const sq of dests.get(selected) ?? []) {
        s[sq] = { ...s[sq], backgroundImage: pos.board.has(parseSquare(sq)!) ? RING : DOT }
      }
    }
    return s
  }, [game.moves, selected, dests, pos, active, premove])

  const roles: Role[] = ['queen', 'rook', 'bishop', 'knight', ...(game.variant === 'antichess' ? (['king'] as Role[]) : [])]

  const checks = (color: 'white' | 'black') => {
    const rc = (pos as unknown as { remainingChecks?: Record<string, number> }).remainingChecks
    return game.variant === 'threecheck' && rc ? `${3 - rc[color]}/3 checks` : ''
  }

  const bar = (color: 'white' | 'black') => {
    const p = color === 'white' ? white : black
    const running = turn === color && clockRunning(game, now)
    const shown = clocks[color]
    return (
      <div className="player">
        <div className="name">
          <span className={`chip ${color === 'white' ? 'w' : 'b'}`} />
          <Flag code={p.country} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.username}</span>
          {checks(color) && <small>{checks(color)}</small>}
        </div>
        <div className={`clock num${running ? ' on' : ''}${shown < 10_000 && active ? ' low' : ''}`}>{fmt(shown)}</div>
      </div>
    )
  }

  let result: { title: string; sub: string } | null = null
  if (!active) {
    const t = game.termination ?? ''
    const reason = REASON[t] ?? (game.variant === 'standard' || game.variant === 'chess960' ? '' : VARIANT_REASON[game.variant] ?? '')
    const winnerName = game.result === 'white' ? white.username : game.result === 'black' ? black.username : ''
    const title =
      t === 'aborted' ? 'Game aborted'
      : game.result === 'draw' ? 'Draw'
      : myColor ? (game.result === myColor ? 'You won' : 'You lost')
      : `${winnerName} won`
    const before = myColor === 'white' ? game.white_rating_before : game.black_rating_before
    const after = myColor === 'white' ? game.white_rating_after : game.black_rating_after
    const delta = before != null && after != null ? Math.round(after) - Math.round(before) : null
    const parts = [
      reason && t !== 'aborted' ? `By ${reason}.` : '',
      delta != null ? `Rating ${Math.round(before!)} → ${Math.round(after!)} (${delta >= 0 ? '+' : ''}${delta})` : '',
    ].filter(Boolean)
    result = { title, sub: parts.join(' ') }
  }

  const rows = Array.from({ length: Math.ceil(san.length / 2) }, (_, i) => i)

  return (
    <>
      <div className="game">
        <div className="board-col">
          {bar(orientation === 'white' ? 'black' : 'white')}
          <div className="board-frame">
            <Chessboard
              options={{
                id: 'board',
                position: makeFen(pos.toSetup()).split(' ')[0],
                boardOrientation: orientation,
                allowDragging: canMove || waiting,
                canDragPiece: ({ piece }) => (canMove || waiting) && mine(piece.pieceType),
                onPieceDrop: ({ sourceSquare, targetSquare }) => {
                  if (!targetSquare) return false
                  if (canMove) return attempt(sourceSquare, targetSquare)
                  if (waiting && targetSquare !== sourceSquare) setPremove({ from: sourceSquare, to: targetSquare })
                  return false
                },
                onSquareClick: ({ piece, square }) => {
                  if (waiting) {
                    if (selected && selected !== square) { setPremove({ from: selected, to: square }); setSelected(null) }
                    else if (piece && mine(piece.pieceType)) { setSelected(square); setPremove(null) }
                    else { setSelected(null); setPremove(null) }
                    return
                  }
                  if (selected && dests.get(selected)?.has(square)) attempt(selected, square)
                  else if (canMove && piece && mine(piece.pieceType)) setSelected(square)
                  else setSelected(null)
                },
                squareStyles,
                lightSquareStyle: { backgroundColor: 'var(--board-l)' },
                darkSquareStyle: { backgroundColor: 'var(--board-d)' },
                alphaNotationStyle: { fontSize: '10px', opacity: 0.7 },
                numericNotationStyle: { fontSize: '10px', opacity: 0.7 },
                animationDurationInMs: 120,
                allowDrawingArrows: false,
              }}
            />
            {promo && (
              <div className="promo">
                <div className="row">
                  {roles.map((r) => (
                    <button key={r} aria-label={`Promote to ${r}`} onClick={() => send(makeUci({ from: promo.from, to: promo.to, promotion: r }))}>
                      {GLYPH[r]}
                    </button>
                  ))}
                  <button aria-label="Cancel" onClick={() => setPromo(null)}>×</button>
                </div>
              </div>
            )}
          </div>
          {bar(orientation)}
        </div>

        <aside className="side">
          <div className="mode">
            <h1>{VARIANT_LABEL[game.variant]}</h1>
            <span className="num">{tcLabel(game.initial_ms, game.increment_ms)}</span>
          </div>
          <div className="moves" ref={listRef}>
            {san.length === 0 ? (
              <p className="moves-empty">Waiting for the first move.</p>
            ) : (
              <ol>
                {rows.map((i) => (
                  <li key={i} className="num">
                    <span className="n">{i + 1}.</span>
                    <span className={san.length === i * 2 + 1 ? 'cur' : ''}>{san[i * 2]}</span>
                    <span className={san.length === i * 2 + 2 ? 'cur' : ''}>{san[i * 2 + 1] ?? ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {result ? (
            <div className="result">
              <strong>{result.title}</strong>
              {result.sub && <span>{result.sub}</span>}
              <Link className="btn block" href="/">Back to lobby</Link>
            </div>
          ) : myColor ? (
            <div className="actions">
              {confirmResign ? (
                <>
                  <button
                    className="btn danger small"
                    onClick={() => {
                      setConfirmResign(false)
                      fetch(`/api/games/${game.id}/resign`, { method: 'POST' }).then((r) => r.json()).then((b) => apply(b.game))
                    }}
                  >
                    {ply < 2 ? 'Abort game' : 'Resign'}
                  </button>
                  <button className="btn ghost small" onClick={() => setConfirmResign(false)}>Keep playing</button>
                </>
              ) : (
                <button className="btn ghost small" onClick={() => setConfirmResign(true)}>{ply < 2 ? 'Abort' : 'Resign'}</button>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  )
}
