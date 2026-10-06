/**
 * Landing page — a STATIC page (no auth call, no WebSocket), prerendered at
 * build so it loads instantly and link previews/crawlers can read it.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const STEPS = [
  { n: '1', title: 'Make a room', body: 'Pick a category. We pull real products from Amazon and hide the prices.' },
  { n: '2', title: 'Share the code', body: 'Friends join with a 4-letter code from any phone or laptop. Or play solo.' },
  { n: '3', title: 'Guess & reveal', body: 'Everyone locks in a price. Closest guess scores up to 1,000 points.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-black text-primary-foreground">$?</span>
            Price Guessr
          </Link>
          <div className="flex-1" />
          {/* Static page (no auth here), so one link covers both signed-in and signed-out visitors. */}
          <Link
            to="/play"
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary"
          >
            Play
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12">
          <p className="mb-4 inline-block w-fit -rotate-2 rounded-lg bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
            Real products. Real prices.
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
            How much does <span className="text-primary">that</span> cost?
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A live price-guessing game for friends. Everyone sees the same Amazon product,
            locks in a guess, and the reveal decides who really knows what things cost.
          </p>
          <div className="mt-10">
            <Link
              to="/play"
              className="inline-flex items-center rounded-xl bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Play now
            </Link>
          </div>

          <ol className="mt-20 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-border bg-card p-5">
                <span className="font-mono text-sm text-primary">{s.n}</span>
                <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </main>

        <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-muted-foreground">
          Built on DeepSpace. Product data from Amazon search results; prices change over time.
        </footer>
      </div>
    </>
  )
}
