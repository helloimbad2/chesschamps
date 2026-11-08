'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function EndQualifiers() {
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
    setOpen(false)
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

export function ResetQualifiers() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function reset() {
    setBusy(true)
    setError('')
    const { error: err } = await createClient().rpc('reset_qualifiers')
    setBusy(false)
    if (err) return setError('Could not reset qualifiers.')
    setOpen(false)
    setText('')
    setDone(true)
    router.refresh()
  }

  if (!open) {
    return (
      <div className="stack">
        <button className="btn danger" onClick={() => { setOpen(true); setDone(false) }}>Reset qualifiers</button>
        {done && <p className="hint" style={{ margin: 0 }}>Qualifiers were reset.</p>}
      </div>
    )
  }
  return (
    <div className="confirm">
      <p>This deletes every game, empties the queue, sets all ratings back to 1000 and reopens qualifiers. Accounts are kept. It can’t be undone.</p>
      <div className="field">
        <label htmlFor="reset-confirm">Type RESET to confirm</label>
        <input id="reset-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn danger small" onClick={reset} disabled={busy || text !== 'RESET'}>Reset qualifiers</button>
        <button className="btn ghost small" onClick={() => { setOpen(false); setText('') }} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}
