import Link from 'next/link'

export default function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="mark" aria-hidden><i /><i /><i /><i /></span>
      Chess Champs
    </Link>
  )
}
