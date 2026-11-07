export const VARIANTS = ['standard', 'chess960', 'threecheck', 'atomic', 'antichess', 'kingofthehill'] as const
export type Variant = (typeof VARIANTS)[number]

export const VARIANT_LABEL: Record<Variant, string> = {
  standard: 'Standard',
  chess960: 'Chess960',
  threecheck: 'Three Check',
  atomic: 'Atomic',
  antichess: 'Antichess',
  kingofthehill: 'King of the Hill',
}

export const TIME_CONTROLS = [
  { label: '1+0', minutes: 1, inc: 0 },
  { label: '3+0', minutes: 3, inc: 0 },
  { label: '3+2', minutes: 3, inc: 2 },
  { label: '5+0', minutes: 5, inc: 0 },
  { label: '10+0', minutes: 10, inc: 0 },
  { label: '30+0', minutes: 30, inc: 0 },
] as const

export const PLACEMENT_GAMES = 5
export const FIRST_MOVE_GRACE_MS = 45_000

export const tcLabel = (initialMs: number, incMs: number) => `${initialMs / 60000}+${incMs / 1000}`
