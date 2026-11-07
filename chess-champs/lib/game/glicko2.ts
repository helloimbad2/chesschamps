// Glicko-2 (Glickman 2013) on a 1000-centred display scale, one game per rating period.
const SCALE = 173.7178
const BASE = 1000
const TAU = 0.5
const EPS = 1e-6

export type Rating = { rating: number; rd: number; vol: number }

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / Math.PI ** 2)
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)))

export function update(me: Rating, opp: Rating, score: number): Rating {
  const mu = (me.rating - BASE) / SCALE
  const phi = me.rd / SCALE
  const muJ = (opp.rating - BASE) / SCALE
  const phiJ = opp.rd / SCALE

  const gj = g(phiJ)
  const ej = E(mu, muJ, phiJ)
  const v = 1 / (gj * gj * ej * (1 - ej))
  const delta = v * gj * (score - ej)

  const a = Math.log(me.vol * me.vol)
  const f = (x: number) => {
    const ex = Math.exp(x)
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU)
  }
  let A = a
  let B: number
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v)
  else {
    let k = 1
    while (f(a - k * TAU) < 0) k++
    B = a - k * TAU
  }
  let fA = f(A), fB = f(B)
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) { A = B; fA = fB } else fA /= 2
    B = C; fB = fC
  }
  const vol = Math.exp(A / 2)

  const phiStar = Math.sqrt(phi * phi + vol * vol)
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const muNew = mu + phiNew * phiNew * gj * (score - ej)

  return { rating: muNew * SCALE + BASE, rd: Math.max(phiNew * SCALE, 45), vol }
}
