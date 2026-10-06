/**
 * Remembers which room an invited player was trying to join while they go off
 * to sign in. The sign-in round-trip (Google/GitHub) doesn't reliably return
 * to the invite page, so without this a new player lands on /play, sees
 * "Create room", and starts their own game instead of joining (seen in a real
 * play-test). Browser storage is fine here: it's a per-device convenience,
 * and every read/write is guarded because storage can be blocked.
 */

const KEY = 'priceguessr:pendingInvite'
const MAX_AGE_MS = 15 * 60 * 1000

export function savePendingInvite(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }))
  } catch {
    /* storage blocked: the player can still use the link again */
  }
}

/** Returns the remembered room code (if fresh) and forgets it. */
export function takePendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    localStorage.removeItem(KEY)
    const { code, at } = JSON.parse(raw) as { code?: unknown; at?: unknown }
    if (typeof code !== 'string' || !/^[A-Z]{4}$/.test(code)) return null
    if (typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) return null
    return code
  } catch {
    return null
  }
}
