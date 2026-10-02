/**
 * Stress the multiplayer paths with 4 real signed-in players:
 *  - three people open the invite link and join at the same moment
 *  - everyone guesses at the same moment (race on the automatic reveal)
 *  - one player joins in the middle of a round
 * and check that every screen agrees on the price and the scores.
 */
import { test, expect, loadAllTestAccounts, type MultiplayerUser } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 4, 'Needs 4 usable test accounts')
test.setTimeout(180_000)

/** The score column of a player's scoreboard, e.g. "784,700,350,0". Names
 *  are left out because each screen calls its own row "You". */
const scoresOf = async (p: MultiplayerUser) => {
  const rows = await p.page.getByTestId('scoreboard').getByRole('listitem').allInnerTexts()
  return rows.map((r) => r.trim().split(/\s+/).pop()).join(',')
}

test('four players: simultaneous joins, simultaneous guesses, late joiner', async ({ users }) => {
  const [host, b, c, late] = await users(4)

  await host.page.goto('/play')
  await host.page.getByTestId('category-tech').click()
  await host.page.getByRole('button', { name: '3', exact: true }).click()
  await host.page.getByTestId('create-room').click()
  await expect(host.page.getByTestId('room-code')).toBeVisible({ timeout: 60_000 })
  const code = (await host.page.getByTestId('room-code').textContent())!.trim()

  // Two friends open the invite link and press Join at the same moment.
  await Promise.all([b, c].map((p) => p.page.goto(`/game/${code}`)))
  await Promise.all([b, c].map((p) => p.page.getByTestId('join-this-room').click()))
  await expect(host.page.getByText('3 players in the room.')).toBeVisible()

  await host.page.getByTestId('start-game').click()
  for (const p of [b, c]) await expect(p.page.getByTestId('product-title')).toBeVisible()

  // A fourth player arrives mid-round via the same link.
  await late.page.goto(`/game/${code}`)
  await late.page.getByTestId('join-this-room').click()
  await expect(late.page.getByTestId('product-title')).toBeVisible()
  await expect(host.page.getByTestId('scoreboard').getByRole('listitem')).toHaveCount(4)

  // All four lock in at the same moment. Exactly one reveal must happen and
  // everyone must see the same price.
  const everyone = [host, b, c, late]
  await Promise.all(everyone.map((p, i) => p.page.getByTestId('guess-input').fill(String(10 + i * 15))))
  await Promise.all(everyone.map((p) => p.page.getByTestId('submit-guess').click()))
  for (const p of everyone) await expect(p.page.getByTestId('actual-price')).toBeVisible()
  const price = await host.page.getByTestId('actual-price').textContent()
  for (const p of everyone) await expect(p.page.getByTestId('actual-price')).toHaveText(price!)

  // Every screen shows the same scores, and someone actually scored
  // (catches both double-counting and a reveal that scored nobody).
  // Scores arrive a moment after the price, so wait for them to settle.
  await expect
    .poll(async () => {
      const boards = await Promise.all(everyone.map(scoresOf))
      const agree = new Set(boards).size === 1
      const scored = boards[0].split(',').map(Number).some((n) => n > 0)
      return agree && scored ? 'settled' : boards.join(' | ')
    })
    .toBe('settled')

  // The host continues; everyone moves on together.
  await host.page.getByTestId('next-round').click()
  for (const p of everyone) await expect(p.page.getByTestId('round-label')).toHaveText('Round 2 of 3')
})
