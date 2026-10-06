/**
 * Gated routes. Any file under src/pages/(app)/(protected)/ requires sign-in.
 * The `(protected)` folder is a Generouted route group — parentheses mean
 * it doesn't appear in the URL. For a dynamic page that does NOT require
 * sign-in, put it directly under src/pages/(app)/; for a static page, put it
 * at the top level of src/pages/.
 *
 * Children may call data hooks like `useUser()` safely because the parent
 * (app)/_layout.tsx mounts <RecordProvider> above this layout.
 *
 * The `fallback` keeps signed-out visitors inside the app's own chrome
 * (without it, AuthGate shows the SDK's full-screen, non-dismissible
 * overlay). The sign-in overlay opens on demand and can be dismissed.
 */

import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { AuthGate } from 'deepspace'
import { SignInOverlay } from '../../../components/SignInOverlay'
import { Button } from '@/components/ui'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<SignedOutPanel />}>
      <Outlet />
    </AuthGate>
  )
}

/**
 * Shown to signed-out visitors. Most arrive from an invite link, so on a
 * /game/:code page we say so, and make clear that "Continue with Google or
 * GitHub" creates an account on the spot. There is no separate sign-up step.
 */
function SignedOutPanel() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { pathname } = useLocation()
  const inviteCode = pathname.match(/^\/game\/([A-Za-z]{4})$/)?.[1]?.toUpperCase()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        {inviteCode ? (
          <>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">You're invited</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">
              Join room{' '}
              <span className="rounded-md bg-primary px-2 font-mono tracking-widest text-primary-foreground">
                {inviteCode}
              </span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Guess the price of real Amazon products with your friends.
            </p>
          </>
        ) : (
          <h1 className="text-lg font-semibold text-foreground">Sign in or create an account</h1>
        )}
        <Button data-testid="signed-out-continue" className="mt-6 w-full" size="lg" onClick={() => setShowAuthModal(true)}>
          Sign up or sign in
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          New here? Choose <strong className="text-foreground">Continue with Google</strong> or{' '}
          <strong className="text-foreground">GitHub</strong>. Your account is created instantly, no
          password needed. Email sign-in only works for existing DeepSpace accounts.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          What is Price Guessr?
        </Link>
      </div>

      {showAuthModal && <SignInOverlay onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}
