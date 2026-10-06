/**
 * Buttons and forms not covered by the main game tests: joining by typing a
 * code, a bad code, finishing a whole game, and "Play again".
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts')
test.setTimeout(120_000)

test('join by typed code, play to the end, play again', async ({ users }) => {
  const [host, guest] = await users(2)

  await host.page.goto('/play')
  await host.page.getByRole('button', { name: '3', exact: true }).click()
  await host.page.getByTestId('create-room').click()
  await expect(host.page.getByTestId('room-code')).toBeVisible({ timeout: 60_000 })
  const code = (await host.page.getByTestId('room-code').textContent())!.trim()

  // A wrong code shows an error and stays put.
  await guest.page.goto('/play')
  await guest.page.getByTestId('join-code').fill('ZZZQ')
  await guest.page.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(guest.page.getByText('No room called ZZZQ')).toBeVisible()
  await expect(guest.page).toHaveURL(/\/play$/)

  // The right code (typed lowercase) joins the room.
  await guest.page.getByTestId('join-code').fill(code.toLowerCase())
  await guest.page.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(guest.page.getByText('Waiting for the host to start')).toBeVisible()

  // Play all 3 rounds to the end.
  await host.page.getByTestId('start-game').click()
  for (let round = 1; round <= 3; round++) {
    await expect(guest.page.getByTestId('round-label')).toHaveText(`Round ${round} of 3`)
    for (const p of [host, guest]) {
      await p.page.getByTestId('guess-input').fill('20')
      await p.page.getByTestId('submit-guess').click()
    }
    await expect(host.page.getByTestId('actual-price')).toBeVisible()
    await host.page.getByTestId('next-round').click()
  }
  for (const p of [host, guest]) await expect(p.page.getByText('Game over!')).toBeVisible()

  // Every revealed product on the final screen links to Amazon.
  const productLinks = guest.page.getByRole('link', { name: /on Amazon$/ })
  await expect(productLinks).toHaveCount(3)
  await expect(productLinks.first()).toHaveAttribute('href', /amazon\./)

  // "Play again" goes back to the start page.
  await guest.page.getByRole('button', { name: 'Play again' }).click()
  await expect(guest.page.getByTestId('create-room')).toBeVisible()
})
