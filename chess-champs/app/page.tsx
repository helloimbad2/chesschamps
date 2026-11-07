import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import QueueButton from '@/components/QueueButton'
import AdminPanel from '@/components/AdminPanel'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
const PLACEMENT_GAMES = 5

export default async function Home() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const [{ data: me }, { data: state }, { data: admin }, { data: queued }, { data: live }] = await Promise.all([
    supabase.from('profiles').select('username, rating, games_played').eq('id', auth.user.id).single(),
    supabase.from('app_state').select('phase').eq('id', 1).single(),
    supabase.rpc('is_admin'),
    supabase.from('queue').select('user_id').eq('user_id', auth.user.id).maybeSingle(),
    supabase.from('games').select('id').eq('status', 'active').or(`white_id.eq.${auth.user.id},black_id.eq.${auth.user.id}`).limit(1).maybeSingle(),
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
        <strong>Chess Champs</strong>
        <div className="who">
          <span>{me.username}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="page">
        <section>
          {placing ? (
            <>
              <div className="rating">{me.games_played}/{PLACEMENT_GAMES}</div>
              <p className="sub">Placement games played</p>
            </>
          ) : (
            <>
              <div className="rating">{Math.round(me.rating)}</div>
              <p className="sub">Your rating</p>
            </>
          )}
          {live ? (
            <Link className="btn" href={`/game/${live.id}`}>Return to your game</Link>
          ) : tournament ? (
            <p className="empty">Qualifiers have ended. The top 16 are seeded on the right.</p>
          ) : (
            <QueueButton initiallyQueued={!!queued} />
          )}
          {admin && !tournament && (
            <div className="admin"><AdminPanel /></div>
          )}
        </section>
        <section>
          <h2>{tournament ? 'Top 16' : 'Leaderboard'}</h2>
          {board && board.length > 0 ? (
            <table>
              <thead><tr><th className="rank">#</th><th>Player</th><th>Rating</th></tr></thead>
              <tbody>
                {board.map((p, i) => (
                  <tr key={p.id} className={p.id === auth.user!.id ? 'me' : undefined}>
                    <td className="rank">{i + 1}</td>
                    <td>{p.username}</td>
                    <td>{Math.round(p.rating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">No one has finished their placement games yet.</p>
          )}
        </section>
      </div>
    </>
  )
}
