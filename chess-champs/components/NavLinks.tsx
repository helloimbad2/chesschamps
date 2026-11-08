'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/play', label: 'Play' },
  { href: '/leaderboard', label: 'Leaderboard' },
]

export default function NavLinks({ admin }: { admin: boolean }) {
  const path = usePathname()
  const items = admin ? [...LINKS, { href: '/admin', label: 'Admin' }] : LINKS
  return (
    <nav className="nav" aria-label="Main">
      {items.map((l) => {
        const on = l.href === '/' ? path === '/' : path.startsWith(l.href)
        return (
          <Link key={l.href} href={l.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
