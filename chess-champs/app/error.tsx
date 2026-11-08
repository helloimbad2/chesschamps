'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="notice">
      <h1>Something went wrong</h1>
      <p className="hint">{error.message}</p>
      <div className="row">
        <button className="btn" onClick={reset}>Try again</button>
        <a className="btn ghost" href="/">Home</a>
      </div>
    </div>
  )
}
