import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import { EndQualifiers, ResetQualifiers } from '@/components/AdminPanel'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: admin } = await supabase.rpc('is_admin')
  if (!admin) redirect('/')
  const { data: state } = await supabase.from('app_state').select('phase').eq('id', 1).single()
  const tournament = state?.phase === 'tournament'

  return (
    <>
      <Header />
      <main className="wrap narrow">
        <h1 className="page-title">Admin</h1>
        <p className="hint">Phase: <strong>{tournament ? 'Tournament' : 'Qualifiers'}</strong></p>
        <div className="admin-grid">
          {!tournament && (
            <section className="card">
              <h2>End qualifiers</h2>
              <p className="hint">Closes the queue and starts the tournament with the top 16.</p>
              <EndQualifiers />
            </section>
          )}
          <section className="card">
            <h2>Reset qualifiers</h2>
            <p className="hint">Wipes all games and ratings and reopens qualifiers.</p>
            <ResetQualifiers />
          </section>
        </div>
      </main>
    </>
  )
}
