import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Flag from '@/components/Flag'
import { PLACEMENT_GAMES } from '@/lib/game/config'

export const dynamic = 'force-dynamic'

export default async function Leaderboard() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const uid = auth.user.id

  const [{ data: state }, { data: players }] = await Promise.all([
    supabase.from('app_state').select('phase').eq('id', 1).single(),
    supabase.from('profiles').select('id, username, rating, games_played, country').gte('games_played', PLACEMENT_GAMES).order('rating', { ascending: false }).limit(200),
  ])
  const tournament = state?.phase === 'tournament'

  return (
    <>
      <Header />
      <main className="wrap narrow">
        <h1 className="page-title">Leaderboard</h1>
        <p className="hint">{tournament ? 'Final qualifier standings. The top 16 are seeded.' : 'The top 16 at the end of qualifiers move on to the tournament.'}</p>
        {players && players.length ? (
          <table>
            <thead><tr><th className="rank">#</th><th>Player</th><th className="r">Games</th><th className="r">Rating</th></tr></thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.id} className={`${p.id === uid ? 'me' : ''}${i === 15 ? ' cut' : ''}`}>
                  <td className="rank num">{i + 1}</td>
                  <td><Link href={`/players/${p.username}`} className="pl"><Flag code={p.country} />{p.username}</Link></td>
                  <td className="r num">{p.games_played}</td>
                  <td className="r num">{Math.round(p.rating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">Nobody is ranked yet. Players appear here after their {PLACEMENT_GAMES} placement games.</p>
        )}
      </main>
    </>
  )
}
