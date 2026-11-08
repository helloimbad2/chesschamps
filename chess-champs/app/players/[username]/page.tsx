import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Flag from '@/components/Flag'
import RatingChart from '@/components/RatingChart'
import { PLACEMENT_GAMES, VARIANTS, VARIANT_LABEL, tcLabel, type Variant } from '@/lib/game/config'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  variant: Variant
  initial_ms: number
  increment_ms: number
  result: 'white' | 'black' | 'draw'
  created_at: string
  white_id: string
  white_rating_before: number | null
  white_rating_after: number | null
  black_rating_before: number | null
  black_rating_after: number | null
  white: { username: string; country: string | null }
  black: { username: string; country: string | null }
}

export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const name = decodeURIComponent(username).replace(/[\\%_]/g, '\\$&')
  const { data: p } = await supabase.from('profiles').select('id, username, rating, games_played, country, created_at').ilike('username', name).maybeSingle()
  if (!p) notFound()

  const placed = p.games_played >= PLACEMENT_GAMES
  const [{ data: games }, ahead] = await Promise.all([
    supabase
      .from('games')
      .select('id, variant, initial_ms, increment_ms, result, created_at, white_id, white_rating_before, white_rating_after, black_rating_before, black_rating_after, white:profiles!games_white_id_fkey(username, country), black:profiles!games_black_id_fkey(username, country)')
      .or(`white_id.eq.${p.id},black_id.eq.${p.id}`)
      .eq('status', 'finished')
      .not('result', 'is', null)
      .order('created_at', { ascending: true })
      .limit(500),
    placed
      ? supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('games_played', PLACEMENT_GAMES).gt('rating', p.rating)
      : Promise.resolve({ count: null }),
  ])

  const rows = ((games ?? []) as unknown as Row[]).map((g) => {
    const white = g.white_id === p.id
    const result = g.result === 'draw' ? 'D' : (g.result === 'white') === white ? 'W' : 'L'
    return {
      id: g.id,
      result,
      variant: g.variant,
      tc: tcLabel(g.initial_ms, g.increment_ms),
      opp: white ? g.black : g.white,
      before: white ? g.white_rating_before : g.black_rating_before,
      after: white ? g.white_rating_after : g.black_rating_after,
      date: new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
  })

  const points = [rows[0]?.before ?? 1000, ...rows.map((r) => r.after).filter((v): v is number => v != null)]
  const w = rows.filter((r) => r.result === 'W').length
  const d = rows.filter((r) => r.result === 'D').length
  const l = rows.length - w - d
  const byVariant = VARIANTS.map((v) => {
    const r = rows.filter((x) => x.variant === v)
    return { v, n: r.length, w: r.filter((x) => x.result === 'W').length, d: r.filter((x) => x.result === 'D').length, l: r.filter((x) => x.result === 'L').length }
  }).filter((x) => x.n > 0)
  const recent = [...rows].reverse().slice(0, 12)

  return (
    <>
      <Header />
      <main className="wrap">
        <div className="profile-head">
          <h1 className="display sm"><Flag code={p.country} />{p.username}</h1>
          <p className="hint">Joined {new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>

        <section className="stats six">
          <div><p className="eyebrow">Rating</p><p className="stat num">{placed ? Math.round(p.rating) : '—'}</p></div>
          <div><p className="eyebrow">Rank</p><p className="stat num">{placed && ahead.count != null ? `#${ahead.count + 1}` : '—'}</p></div>
          <div><p className="eyebrow">Games</p><p className="stat num">{rows.length}</p></div>
          <div><p className="eyebrow">Record</p><p className="stat num">{w}-{d}-{l}</p></div>
          <div><p className="eyebrow">Win rate</p><p className="stat num">{rows.length ? `${Math.round((w / rows.length) * 100)}%` : '—'}</p></div>
          <div><p className="eyebrow">Peak</p><p className="stat num">{rows.length ? Math.round(Math.max(...points)) : '—'}</p></div>
        </section>
        {!placed && <p className="hint">{p.games_played} of {PLACEMENT_GAMES} placement games played.</p>}

        <section className="card">
          <div className="section-head"><h2>Rating</h2></div>
          <RatingChart points={points} />
        </section>

        <section className="cols">
          <div>
            <div className="section-head"><h2>By variant</h2></div>
            {byVariant.length ? (
              <table>
                <thead><tr><th>Variant</th><th className="r">Games</th><th className="r">W-D-L</th></tr></thead>
                <tbody>
                  {byVariant.map((x) => (
                    <tr key={x.v}><td>{VARIANT_LABEL[x.v]}</td><td className="r num">{x.n}</td><td className="r num">{x.w}-{x.d}-{x.l}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="empty">No finished games yet.</p>}
          </div>
          <div>
            <div className="section-head"><h2>Recent games</h2></div>
            {recent.length ? (
              <ul className="list">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link href={`/game/${r.id}`}>
                      <span className="vs">
                        <b className={`res ${r.result}`}>{r.result}</b>
                        <Flag code={r.opp.country} />{r.opp.username}
                      </span>
                      <span className="meta">
                        {VARIANT_LABEL[r.variant]} · {r.tc}
                        {r.before != null && r.after != null && (
                          <em className="num"> {Math.round(r.after) - Math.round(r.before) >= 0 ? '+' : ''}{Math.round(r.after) - Math.round(r.before)}</em>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="empty">No finished games yet.</p>}
          </div>
        </section>
      </main>
    </>
  )
}
