/**
 * An invited player who has to sign in first must end up back in the room
 * they were invited to, not on the start page (where they'd make their own
 * room). Real bug from a play-test: the sign-in round-trip lost the invite.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 1, 'Needs 1 usable test account')

test('signed-out invite tap is remembered and resumed after sign-in', async ({ page, users }) => {
  // Signed out: tapping "Sign up or sign in" on an invite remembers the room.
  await page.goto('/game/qxzv')
  await page.getByTestId('signed-out-continue').click()
  const saved = await page.evaluate(() => localStorage.getItem('priceguessr:pendingInvite'))
  expect(saved).toContain('QXZV')

  // Simulate the sign-in round-trip landing a signed-in player on /play with
  // that same browser storage: they get sent back to the room, once.
  const [player] = await users(1)
  await player.page.goto('/')
  await player.page.evaluate((v) => localStorage.setItem('priceguessr:pendingInvite', v!), saved)
  await player.page.goto('/play')
  await expect(player.page).toHaveURL(/\/game\/QXZV$/)
  expect(await player.page.evaluate(() => localStorage.getItem('priceguessr:pendingInvite'))).toBeNull()
})
