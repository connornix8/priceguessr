/**
 * End-to-end: two real signed-in players play a Price Guessr game in two
 * separate browsers, against the real dev server and real Amazon data.
 *
 * Proves the important path: create → join by link → start → both see the
 * same product → price is hidden until everyone guesses → auto-reveal with
 * scores on both screens → host advances to round 2.
 *
 * Note: creating a game may make one real (owner-billed, ~$0.03) Amazon
 * search the first time a category's product pool is empty.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts')
test.setTimeout(120_000)

test('two players play a round and both see the reveal', async ({ users }) => {
  const [host, guest] = await users(2)

  // Record every WebSocket message the server sends to the guest's browser,
  // so we can prove the real price never reached it before the reveal.
  const guestFrames: string[] = []
  guest.page.on('websocket', (ws) =>
    ws.on('framereceived', (f) => guestFrames.push(typeof f.payload === 'string' ? f.payload : '')),
  )

  // Host creates a 3-round Kitchen game.
  await host.page.goto('/play')
  await host.page.getByTestId('category-kitchen').click()
  await host.page.getByRole('button', { name: '3', exact: true }).click()
  await host.page.getByTestId('create-room').click()
  await expect(host.page.getByTestId('room-code')).toBeVisible({ timeout: 60_000 })
  const code = (await host.page.getByTestId('room-code').textContent())!.trim()
  expect(code).toMatch(/^[A-Z]{4}$/)

  // Guest opens the invite link and joins; the host's lobby updates live.
  await guest.page.goto(`/game/${code}`)
  await guest.page.getByTestId('join-this-room').click()
  await expect(guest.page.getByText('Waiting for the host to start')).toBeVisible()
  await expect(host.page.getByText('2 players in the room.')).toBeVisible()

  // Host starts; both see the same product, and no price anywhere yet.
  await host.page.getByTestId('start-game').click()
  const hostTitle = host.page.getByTestId('product-title')
  const guestTitle = guest.page.getByTestId('product-title')
  await expect(hostTitle).toBeVisible()
  await expect(guestTitle).toHaveText((await hostTitle.textContent())!)
  await expect(guest.page.getByTestId('actual-price')).toHaveCount(0)

  // Host guesses first: guest's screen shows them as locked in, still no reveal.
  await host.page.getByTestId('guess-input').fill('10')
  await host.page.getByTestId('submit-guess').click()
  await expect(host.page.getByTestId('guess-status')).toContainText('Locked in at $10.00')
  await expect(guest.page.getByTestId('scoreboard')).toContainText('locked in')
  await expect(guest.page.getByTestId('actual-price')).toHaveCount(0)

  const framesBeforeReveal = guestFrames.length

  // Guest guesses last, which auto-reveals the price on both screens.
  await guest.page.getByTestId('guess-input').fill('25')
  await guest.page.getByTestId('submit-guess').click()
  await expect(host.page.getByTestId('actual-price')).toHaveText(/^\$[\d,]+\.\d{2}$/)
  await expect(guest.page.getByTestId('actual-price')).toHaveText(
    (await host.page.getByTestId('actual-price').textContent())!,
  )

  // Security check: the revealed price (in cents) appears in NO message the
  // guest received before the reveal — it never left the server.
  const shown = (await host.page.getByTestId('actual-price').textContent())!
  const cents = Math.round(Number(shown.replace(/[$,]/g, '')) * 100)
  expect(framesBeforeReveal).toBeGreaterThan(0)
  const leaked = guestFrames.slice(0, framesBeforeReveal).filter((f) => f.includes(`"price":${cents}`))
  expect(leaked).toEqual([])
  // ...and after the reveal it does arrive (proves the check above can see prices).
  await expect
    .poll(() => guestFrames.slice(framesBeforeReveal).some((f) => f.includes(`"price":${cents}`)))
    .toBe(true)

  // Each player gets a verdict about their own guess.
  await expect(host.page.getByTestId('verdict')).toContainText(/You were \d+% too (high|low)|nailed/)

  // Only the host can advance; both screens move to round 2.
  await expect(guest.page.getByTestId('next-round')).toHaveCount(0)
  await host.page.getByTestId('next-round').click()
  await expect(guest.page.getByTestId('round-label')).toHaveText('Round 2 of 3')

  // Clicking away doesn't lose the game: "New game" lists it with a Rejoin link.
  await guest.page.getByRole('link', { name: 'New game' }).first().click()
  const inProgress = guest.page.getByTestId('games-in-progress')
  await expect(inProgress).toContainText(code)
  // Pick THIS game's row: other specs using the same test accounts may have games too.
  await inProgress.getByRole('listitem').filter({ hasText: code }).getByRole('link', { name: 'Rejoin' }).click()
  await expect(guest.page.getByTestId('round-label')).toHaveText('Round 2 of 3')
})
