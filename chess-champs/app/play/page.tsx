import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { syncCountry } from '@/lib/country'
import Header from '@/components/Header'
import QueueButton from '@/components/QueueButton'
import { PLACEMENT_GAMES, TIME_CONTROLS, VARIANTS, VARIANT_LABEL } from '@/lib/game/config'

export const dynamic = 'force-dynamic'

export default async function Play() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const uid = auth.user.id

  const [{ data: me }, { data: state }, { data: queued }, { data: live }] = await Promise.all([
    supabase.from('profiles').select('rating, games_played, country').eq('id', uid).single(),
    supabase.from('app_state').select('phase').eq('id', 1).single(),
    supabase.from('queue').select('user_id').eq('user_id', uid).maybeSingle(),
    supabase.from('games').select('id').eq('status', 'active').or(`white_id.eq.${uid},black_id.eq.${uid}`).limit(1).maybeSingle(),
  ])
  if (!me) redirect('/login')
  await syncCountry(uid, me.country)

  const tournament = state?.phase === 'tournament'
  const placing = me.games_played < PLACEMENT_GAMES

  return (
    <>
      <Header />
      <main className="wrap narrow">
        <section className="play-card">
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
              <p className="eyebrow">Your rating</p>
              <p className="rating">{Math.round(me.rating)}</p>
            </>
          )}
          {live ? (
            <Link className="btn block" href={`/game/${live.id}`}>Return to your game</Link>
          ) : tournament ? (
            <p className="hint" style={{ margin: 0 }}>Qualifiers are over.</p>
          ) : (
            <QueueButton initiallyQueued={!!queued} />
          )}
        </section>
        <section className="how">
          <p className="eyebrow">Every queue is one game</p>
          <p className="chips">{VARIANTS.map((v) => <span key={v} className="chip-tc">{VARIANT_LABEL[v]}</span>)}</p>
          <p className="chips">{TIME_CONTROLS.map((t) => <span key={t.label} className="chip-tc num">{t.label}</span>)}</p>
        </section>
      </main>
    </>
  )
}
