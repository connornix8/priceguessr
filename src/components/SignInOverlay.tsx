/**
 * DeepSpace's sign-in window with Price Guessr wording. Google and GitHub
 * create an account on first use, so this one window is both sign-up and
 * sign-in; the default heading ("Sign in to DeepSpace") hid that from new players.
 */

import { AuthOverlay } from 'deepspace'

export function SignInOverlay({ onClose }: { onClose: () => void }) {
  return (
    <AuthOverlay
      onClose={onClose}
      title="Sign up or sign in"
      description="New here? Continue with Google or GitHub. Your account is created automatically."
    />
  )
}
