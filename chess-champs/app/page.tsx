import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Brand from '@/components/Brand'
import LogoutButton from '@/components/LogoutButton'
import QueueButton from '@/components/QueueButton'
import AdminPanel from '@/components/AdminPanel'
import { PLACEMENT_GAMES } from '@/lib/game/config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const uid = auth.user.id

  const [{ data: me }, { data: state }, { data: admin }, { data: queued }, { data: live }] = await Promise.all([
    supabase.from('profiles').select('username, rating, games_played').eq('id', uid).single(),
    supabase.from('app_state').select('phase').eq('id', 1).single(),
    supabase.rpc('is_admin'),
    supabase.from('queue').select('user_id').eq('user_id', uid).maybeSingle(),
    supabase.from('games').select('id').eq('status', 'active').or(`white_id.eq.${uid},black_id.eq.${uid}`).limit(1).maybeSingle(),
  ])
  if (!me) redirect('/login')

  const tournament = state?.phase === 'tournament'
  const { data: board } = await supabase
    .from('profiles')
    .select('id, username, rating')
    .gte('games_played', PLACEMENT_GAMES)
    .order('rating', { ascending: false })
    .limit(tournament ? 16 : 50)

  const placing = me.games_played < PLACEMENT_GAMES

  return (
    <>
      <header className="top">
        <Brand />
        <div className="who">
          <strong>{me.username}</strong>
          <LogoutButton />
        </div>
      </header>
      <div className="lobby">
        <section>
          {placing ? (
            <>
              <p className="eyebrow">Placement</p>
              <div className="dots" aria-label={`${me.games_played} of ${PLACEMENT_GAMES} placement games played`}>
                {Array.from({ length: PLACEMENT_GAMES }, (_, i) => <i key={i} className={i < me.games_played ? 'on' : ''} />)}
              </div>
              <p className="hint">{PLACEMENT_GAMES - me.games_played} more {PLACEMENT_GAMES - me.games_played === 1 ? 'game' : 'games'} to get your rating.</p>
            </>
          ) : (
            <>
              <p className="eyebrow">Rating</p>
              <p className="rating">{Math.round(me.rating)}</p>
            </>
          )}
          {live ? (
            <Link className="btn block" href={`/game/${live.id}`}>Return to your game</Link>
          ) : tournament ? (
            <p className="hint" style={{ margin: 0 }}>Qualifiers are over. The top 16 are seeded.</p>
          ) : (
            <QueueButton initiallyQueued={!!queued} />
          )}
          {admin && !tournament && <div className="admin"><AdminPanel /></div>}
        </section>
        <section>
          <h2 className="board-title">{tournament ? 'Top 16' : 'Leaderboard'}</h2>
          {board && board.length > 0 ? (
            <table>
              <thead><tr><th className="rank">#</th><th>Player</th><th>Rating</th></tr></thead>
              <tbody>
                {board.map((p, i) => (
                  <tr key={p.id} className={p.id === uid ? 'me' : undefined}>
                    <td className="rank num">{i + 1}</td>
                    <td>{p.username}</td>
                    <td className="num">{Math.round(p.rating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">Nobody is ranked yet.</p>
          )}
        </section>
      </div>
    </>
  )
}
