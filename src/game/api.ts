/**
 * Browser-side helper for calling our server actions (src/actions/index.ts).
 * Sends the signed-in user's token; the server decides who they are from it.
 */

import { getAuthToken } from 'deepspace'

export type ActionName =
  | 'createGame'
  | 'joinGame'
  | 'startGame'
  | 'submitGuess'
  | 'revealRound'
  | 'nextRound'

export async function callAction<T = Record<string, unknown>>(
  name: ActionName,
  params: Record<string, unknown>,
): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in first')

  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: string }
    | null

  if (!body) throw new Error(`Server error (${res.status})`)
  if (!body.success) throw new Error(body.error || 'Something went wrong')
  return body.data
}
