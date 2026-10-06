/**
 * DeepSpace's sign-in window with Price Guessr wording. Google and GitHub
 * create an account on first use, so this one window is both sign-up and
 * sign-in; the default heading ("Sign in to DeepSpace") hid that from new players.
 * DeepSpace closes public email sign-up platform-wide and always shows the
 * email form, so we tell new players to skip it.
 */

import { AuthOverlay } from 'deepspace'

export function SignInOverlay({ onClose }: { onClose: () => void }) {
  return (
    <AuthOverlay
      onClose={onClose}
      title="Sign up or sign in"
      description="New here? Use Continue with Google or GitHub. Your account is created automatically. (Email is only for existing DeepSpace accounts.)"
    />
  )
}
