'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const board = Array.from({ length: 64 }, (_, i) => {
  const r = Math.floor(i / 8), c = i % 8
  if ((r === 4 && c === 3) || (r === 3 && c === 4)) return 'a'
  return (r + c) % 2 ? 'd' : 'l'
})

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const isLogin = mode === 'login'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    const username = String(f.get('username') || '').trim()
    const password = String(f.get('password') || '')
    setBusy(true)

    if (isLogin) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) return router.replace('/')
      setError((await res.json().catch(() => ({}))).error || 'Something went wrong. Try again.')
      return setBusy(false)
    }

    const email = String(f.get('email') || '').trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      setError('Usernames are 3 to 16 letters, numbers or underscores.')
      return setBusy(false)
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return setBusy(false)
    }
    const supabase = createClient()
    const escaped = username.replace(/[\\%_]/g, '\\$&')
    const { data: taken } = await supabase.from('profiles').select('id').ilike('username', escaped).maybeSingle()
    if (taken) {
      setError('That username is taken.')
      return setBusy(false)
    }
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setBusy(false)
    if (err) return setError(err.message)
    setSent(true)
  }

  return (
    <div className="auth">
      <main className="auth-main">
        <div className="wordmark">Chess Champs</div>
        {sent ? (
          <>
            <h1>Check your email</h1>
            <p className="sub" style={{ margin: 0 }}>Open the link we sent to finish creating your account, then log in.</p>
            <p className="alt"><Link href="/login">Go to log in</Link></p>
          </>
        ) : (
          <>
            <h1>{isLogin ? 'Log in' : 'Create account'}</h1>
            <form onSubmit={onSubmit} noValidate>
              {!isLogin && (
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" autoComplete="email" required />
                </div>
              )}
              <div className="field">
                <label htmlFor="username">Username</label>
                <input id="username" name="username" autoComplete="username" required />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required />
              </div>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="btn" disabled={busy}>{isLogin ? 'Log in' : 'Create account'}</button>
            </form>
            <p className="alt">
              {isLogin ? <>No account? <Link href="/register">Create one</Link></> : <>Have an account? <Link href="/login">Log in</Link></>}
            </p>
          </>
        )}
      </main>
      <div className="board-wrap" aria-hidden>
        <div className="board-inner">{board.map((k, i) => <i key={i} className={k} />)}</div>
      </div>
    </div>
  )
}
