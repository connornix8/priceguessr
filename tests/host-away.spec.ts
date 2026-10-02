/**
 * If the host walks away mid-game, the other players must not be stuck.
 * After HOST_AWAY_MS (60s) of no progress, any player can reveal and continue.
 * Slow by design: it waits out the real timer twice (~2 minutes).
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts')
test.setTimeout(240_000)

test('players can carry on when the host goes quiet', async ({ users }) => {
  const [host, guest] = await users(2)

  await host.page.goto('/play')
  await host.page.getByRole('button', { name: '3', exact: true }).click()
  await host.page.getByTestId('create-room').click()
  await expect(host.page.getByTestId('room-code')).toBeVisible({ timeout: 60_000 })
  const code = (await host.page.getByTestId('room-code').textContent())!.trim()
  await guest.page.goto(`/game/${code}`)
  await guest.page.getByTestId('join-this-room').click()
  await host.page.getByTestId('start-game').click()

  // The host stops playing. The guest guesses and is waiting on the host.
  await host.page.close()
  await guest.page.getByTestId('guess-input').fill('30')
  await guest.page.getByTestId('submit-guess').click()
  await expect(guest.page.getByTestId('guess-status')).toContainText('Waiting on')

  // No way to skip ahead early...
  await expect(guest.page.getByTestId('reveal-now')).toHaveCount(0)
  // ...but after a minute of silence, the guest can reveal.
  await expect(guest.page.getByTestId('reveal-now')).toBeVisible({ timeout: 75_000 })
  await guest.page.getByTestId('reveal-now').click()
  await expect(guest.page.getByTestId('actual-price')).toBeVisible()

  // Same for moving on to the next product.
  await expect(guest.page.getByRole('button', { name: 'Host away? Continue' })).toBeVisible({
    timeout: 75_000,
  })
  await guest.page.getByRole('button', { name: 'Host away? Continue' }).click()
  await expect(guest.page.getByTestId('round-label')).toHaveText('Round 2 of 3')
})
