export default function RatingChart({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="empty">The rating graph appears after the first finished game.</p>
  const W = 640, H = 220, L = 46, R = 14, T = 14, B = 26
  const lo = Math.floor((Math.min(...points) - 20) / 10) * 10
  const hi = Math.ceil((Math.max(...points) + 20) / 10) * 10
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B)
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - B} L${L} ${H - B} Z`
  const mid = Math.round((lo + hi) / 2 / 10) * 10
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rating over ${points.length - 1} games, now ${Math.round(last)}`} className="chart">
      {[hi, mid, lo].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="axis">{v}</text>
        </g>
      ))}
      <path d={area} className="area" />
      <path d={line} className="line" />
      <circle cx={x(points.length - 1)} cy={y(last)} r="4.5" className="dot" />
      <text x={L} y={H - 6} className="axis">Start</text>
      <text x={W - R} y={H - 6} textAnchor="end" className="axis">Game {points.length - 1}</text>
    </svg>
  )
}
