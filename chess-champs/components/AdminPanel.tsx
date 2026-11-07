'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminPanel() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function end() {
    setBusy(true)
    setError('')
    const { error: err } = await createClient().rpc('end_qualifiers')
    setBusy(false)
    if (err) return setError('Could not end qualifiers.')
    router.refresh()
  }

  if (!open) return <button className="btn danger" onClick={() => setOpen(true)}>End qualifiers</button>
  return (
    <div className="confirm">
      <p>This closes the queue and starts the tournament with the top 16. It can’t be undone.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn danger small" onClick={end} disabled={busy}>End qualifiers</button>
        <button className="btn ghost small" onClick={() => setOpen(false)} disabled={busy}>Keep going</button>
      </div>
    </div>
  )
}
