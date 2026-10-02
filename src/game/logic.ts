/**
 * Pure game rules — no network, no database. Shared by the server actions and
 * the UI, and covered by unit tests in logic.test.ts.
 */

export interface Category {
  id: string
  label: string
  /** Amazon search phrases used to fill this category's product pool. */
  queries: string[]
}

export const CATEGORIES: Category[] = [
  { id: 'kitchen', label: 'Kitchen', queries: ['kitchen gadgets', 'cookware set', 'coffee accessories'] },
  { id: 'tech', label: 'Tech', queries: ['tech gadgets', 'phone accessories', 'smart home devices'] },
  { id: 'toys', label: 'Toys & Games', queries: ['toys for kids', 'board games', 'lego sets'] },
  { id: 'home', label: 'Home', queries: ['home decor', 'bedroom accessories', 'bathroom organizers'] },
  { id: 'outdoors', label: 'Outdoors', queries: ['camping gear', 'garden tools', 'fitness equipment'] },
  { id: 'weird', label: 'Weird Stuff', queries: ['weird gifts', 'funny gag gifts', 'unusual gadgets'] },
]

export const ROUND_OPTIONS = [3, 5, 8] as const
export const MAX_POINTS = 1000
/** Biggest guess we accept, in dollars. */
export const MAX_GUESS_DOLLARS = 100_000

export function findCategory(id: unknown): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

/** "$1,249.99" -> 124999 (cents). Returns null for anything that isn't a single clean price. */
export function parsePriceToCents(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const match = raw.trim().match(/^\$\s?([\d,]+(?:\.\d{1,2})?)$/)
  if (!match) return null
  const dollars = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(dollars) || dollars <= 0) return null
  return Math.round(dollars * 100)
}

/** Dollar amount typed by a player -> cents, or null if it isn't a valid guess. */
export function guessToCents(dollars: unknown): number | null {
  const n = typeof dollars === 'string' ? Number(dollars) : dollars
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (n <= 0 || n > MAX_GUESS_DOLLARS) return null
  return Math.round(n * 100)
}

/**
 * Points for one guess: 1000 for exact, falling linearly to 0 when the guess
 * is off by 100% or more of the real price. Percent-based so a $5 item and a
 * $500 item are equally hard.
 */
export function scoreGuess(guessCents: number, priceCents: number): number {
  if (priceCents <= 0) return 0
  const errorRatio = Math.abs(guessCents - priceCents) / priceCents
  return Math.round(MAX_POINTS * Math.max(0, 1 - errorRatio))
}

/** No I or O, so codes can't be misread as 1 or 0. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export function makeRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  return code
}

export function normalizeRoomCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const code = input.trim().toUpperCase()
  return /^[A-Z]{4}$/.test(code) ? code : null
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Deterministic record ids, so retries overwrite instead of duplicating. */
export const ids = {
  round: (gameId: string, index: number) => `${gameId}_r${index}`,
  player: (gameId: string, userId: string) => `${gameId}_p_${userId}`,
  guess: (roundId: string, userId: string) => `${roundId}_g_${userId}`,
}

export interface Verdict {
  /** Short headline, e.g. "So close!" */
  label: string
  /** Detail, e.g. "You were 22% too high" */
  detail: string
  tone: 'great' | 'good' | 'meh' | 'bad'
}

/** Friendly reveal message based on how far off a guess was, in percent. */
export function verdictFor(guessCents: number, priceCents: number): Verdict {
  const diff = guessCents - priceCents
  const pct = Math.round((Math.abs(diff) / priceCents) * 100)
  const direction = diff > 0 ? 'too high' : 'too low'
  const detail = pct === 0 ? 'You nailed the exact price' : `You were ${pct}% ${direction}`
  if (pct <= 2) return { label: 'Spot on!', detail, tone: 'great' }
  if (pct <= 10) return { label: 'So close!', detail, tone: 'great' }
  if (pct <= 25) return { label: 'Not bad', detail, tone: 'good' }
  if (pct <= 50) return { label: 'A bit off', detail, tone: 'meh' }
  return { label: 'Way off…', detail, tone: 'bad' }
}
