'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function QueueButton({ initiallyQueued }: { initiallyQueued: boolean }) {
  const router = useRouter()
  const [queued, setQueued] = useState(initiallyQueued)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // While queued, poll for a match. The poll also tells the server we are still here.
  useEffect(() => {
    if (!queued) return
    const id = setInterval(async () => {
      try {
        const body = await (await fetch('/api/queue')).json()
        if (body.gameId) router.push(`/game/${body.gameId}`)
        else if (body.queued === false) setQueued(false)
      } catch {}
    }, 2000)
    return () => clearInterval(id)
  }, [queued, router])

  async function join() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/queue', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) setError(body.error || 'Could not join the queue.')
      else if (body.gameId) router.push(`/game/${body.gameId}`)
      else setQueued(true)
    } catch {
      setError('Could not join the queue. Try again.')
    }
    setBusy(false)
  }

  async function leave() {
    setBusy(true)
    await fetch('/api/queue', { method: 'DELETE' }).catch(() => {})
    setQueued(false)
    setBusy(false)
  }

  return (
    <div className="stack">
      <button className={queued ? 'btn ghost' : 'btn'} onClick={queued ? leave : join} disabled={busy}>
        {queued ? 'Cancel search' : 'Play ranked qualifiers'}
      </button>
      {queued && <p className="sub" style={{ margin: 0 }}>Looking for an opponent</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}
