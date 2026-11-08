import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { syncCountry } from '@/lib/country'
import Header from '@/components/Header'
import Flag from '@/components/Flag'
import ShowcaseBoard from '@/components/ShowcaseBoard'
import { PLACEMENT_GAMES, TIME_CONTROLS, VARIANTS, VARIANT_BLURB, VARIANT_LABEL, tcLabel, type Variant } from '@/lib/game/config'

export const dynamic = 'force-dynamic'
const SHOWCASE = 'r2q1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1'

type LiveGame = {
  id: string
  variant: Variant
  initial_ms: number
  increment_ms: number
  white: { username: string; country: string | null }
  black: { username: string; country: string | null }
}

export default async function Home() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const uid = auth.user.id

  const [{ data: me }, { data: state }, ranked, played, { data: live }, { data: top }] = await Promise.all([
    supabase.from('profiles').select('username, rating, games_played, country').eq('id', uid).single(),
    supabase.from('app_state').select('phase').eq('id', 1).single(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('games_played', PLACEMENT_GAMES),
    supabase.from('games').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
    supabase
      .from('games')
      .select('id, variant, initial_ms, increment_ms, white:profiles!games_white_id_fkey(username, country), black:profiles!games_black_id_fkey(username, country)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('profiles').select('id, username, rating, country').gte('games_played', PLACEMENT_GAMES).order('rating', { ascending: false }).limit(5),
  ])
  if (!me) redirect('/login')
  await syncCountry(uid, me.country)

  const tournament = state?.phase === 'tournament'
  const placing = me.games_played < PLACEMENT_GAMES
  const liveGames = (live ?? []) as unknown as LiveGame[]

  return (
    <>
      <Header />
      <main className="wrap">
        <section className="hero">
          <div>
            <p className="eyebrow">{tournament ? 'Tournament' : 'Qualifiers open'}</p>
            <h1 className="display">Chess, six ways.</h1>
            <p className="lede">
              {tournament
                ? 'Qualifiers are over and the top 16 are seeded.'
                : 'Queue for a ranked game. The variant and the time control are random, and the top 16 players move on to the tournament.'}
            </p>
            <div className="row">
              {!tournament && <Link className="btn" href="/play">Play now</Link>}
              <Link className="btn ghost" href="/leaderboard">{tournament ? 'See the top 16' : 'Leaderboard'}</Link>
            </div>
          </div>
          <div className="hero-board" aria-hidden><ShowcaseBoard id="hero-board" position={SHOWCASE} /></div>
        </section>

        <section className="stats">
          <div>
            <p className="eyebrow">{placing ? 'Placement' : 'Your rating'}</p>
            <p className="stat num">{placing ? `${me.games_played}/${PLACEMENT_GAMES}` : Math.round(me.rating)}</p>
          </div>
          <div><p className="eyebrow">Ranked players</p><p className="stat num">{ranked.count ?? 0}</p></div>
          <div><p className="eyebrow">Games played</p><p className="stat num">{played.count ?? 0}</p></div>
          <div><p className="eyebrow">Live now</p><p className="stat num">{liveGames.length}</p></div>
        </section>

        <section className="cols">
          <div>
            <div className="section-head"><h2>Live games</h2></div>
            {liveGames.length ? (
              <ul className="list">
                {liveGames.map((g) => (
                  <li key={g.id}>
                    <Link href={`/game/${g.id}`}>
                      <span className="vs"><Flag code={g.white.country} />{g.white.username}<em>vs</em><Flag code={g.black.country} />{g.black.username}</span>
                      <span className="meta">{VARIANT_LABEL[g.variant]} · {tcLabel(g.initial_ms, g.increment_ms)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No games in progress.</p>
            )}
          </div>
          <div>
            <div className="section-head"><h2>Top players</h2><Link href="/leaderboard">View all</Link></div>
            {top && top.length ? (
              <ul className="list">
                {top.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/players/${p.username}`}>
                      <span className="vs"><span className="rk num">{i + 1}</span><Flag code={p.country} />{p.username}</span>
                      <span className="meta num">{Math.round(p.rating)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">Nobody is ranked yet.</p>
            )}
          </div>
        </section>

        <section>
          <div className="section-head"><h2>The variants</h2></div>
          <div className="variants">
            {VARIANTS.map((v) => (
              <div key={v} className="variant">
                <strong>{VARIANT_LABEL[v]}</strong>
                <span>{VARIANT_BLURB[v]}</span>
              </div>
            ))}
          </div>
          <p className="chips">{TIME_CONTROLS.map((t) => <span key={t.label} className="chip-tc num">{t.label}</span>)}</p>
        </section>
      </main>
    </>
  )
}
