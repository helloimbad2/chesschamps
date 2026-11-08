import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { GameRow } from '@/lib/game/types'
import GameClient from '@/components/GameClient'
import Header from '@/components/Header'

export const dynamic = 'force-dynamic'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: game } = await supabase.from('games').select('*').eq('id', id).maybeSingle()
  if (!game) notFound()

  const { data: players } = await supabase
    .from('profiles')
    .select('id, username, country')
    .in('id', [game.white_id, game.black_id])
  const info = (uid: string) => players?.find((p) => p.id === uid) ?? { id: uid, username: 'Player', country: null }

  return (
    <>
    <Header />
    <GameClient
      initial={game as GameRow}
      serverNow={Date.now()}
      myId={auth.user.id}
      white={info(game.white_id)}
      black={info(game.black_id)}
    />
    </>
  )
}
