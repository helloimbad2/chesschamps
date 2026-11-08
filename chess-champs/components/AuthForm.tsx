'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Chessboard } from 'react-chessboard'
import { createClient } from '@/lib/supabase/client'
import Brand from './Brand'

const SHOWCASE = 'r2q1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1'

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
        <Brand />
        <div className="auth-form">
          {sent ? (
            <>
              <h1>Check your email</h1>
              <p className="hint" style={{ margin: 0 }}>Open the link we sent to finish creating your account, then log in.</p>
              <p className="alt"><Link href="/login">Go to log in</Link></p>
            </>
          ) : (
            <>
              <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
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
                <button className="btn block" disabled={busy}>{isLogin ? 'Log in' : 'Create account'}</button>
              </form>
              <p className="alt">
                {isLogin ? <>New here? <Link href="/register">Create an account</Link></> : <>Already registered? <Link href="/login">Log in</Link></>}
              </p>
            </>
          )}
        </div>
      </main>
      <div className="auth-art" aria-hidden>
        <div>
          <Chessboard
            options={{
              id: 'showcase',
              position: SHOWCASE,
              allowDragging: false,
              showNotation: false,
              lightSquareStyle: { backgroundColor: 'var(--board-l)' },
              darkSquareStyle: { backgroundColor: 'var(--board-d)' },
              boardStyle: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.14)' },
            }}
          />
        </div>
      </div>
    </div>
  )
}
