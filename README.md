# Price Guessr

A live multiplayer price-guessing game built on [DeepSpace](https://docs.deep.space).
Everyone in a room sees the same real Amazon product, locks in a guess, and the
reveal shows who really knows what things cost.

**Live:** https://priceguessr.app.space

## How to play

1. Sign in and pick a category (Kitchen, Tech, Toys & Games, Home, Outdoors, Weird Stuff) and 3, 5, or 8 rounds.
2. Share the 4-letter room code or invite link. Friends join from any phone or laptop, or you play solo.
3. Each round, everyone guesses the price. When the last player locks in, the price is revealed on every screen.
4. Points are percentage-based: 1,000 for an exact guess, falling to 0 at 100% off, so a $5 item and a $500 item are equally hard.

## How it's built

| Piece | DeepSpace primitive | Where |
|---|---|---|
| Sign-in | Built-in auth (`DeepSpaceAuthProvider`, `AuthGate`) | `src/pages/(app)/` |
| Game data | `RecordRoom` collections with per-role permissions | `src/schemas/game-schemas.ts` |
| Live updates | `useQuery` over the records WebSocket | `src/pages/(app)/(protected)/game/[code].tsx` |
| Game rules | Server actions (`POST /api/actions/:name`) | `src/actions/index.ts` |
| Player names | `useUserLookup` (public-identity roster) | game page |
| Product data | `amazon/search-products` integration, owner-billed | `src/actions/index.ts`, `src/integrations.ts` |
| Hosting | `npx deepspace deploy` to `priceguessr.app.space` | |

Pure game rules (scoring, price parsing, room codes, the host-away rule) live in
`src/game/logic.ts`, shared by the server and the UI and unit-tested.

### Anti-cheat: the price never reaches a browser early

- Real prices are stored in `answers` and `product_pool`, collections that **no
  role can read**. DeepSpace checks permissions inside the Durable Object
  before anything is sent over the WebSocket, so these rows never leave the
  server.
- Players can only **read** game state. Every write (create, join, guess,
  reveal, next) goes through a server action that checks the rules first: is
  the caller in this game, is it the right phase, are they the host.
- On reveal, the server copies the price and everyone's results onto the
  public round row. Guesses stay hidden until then, so nobody can copy a rival.
- An end-to-end test records every WebSocket message a player receives and
  asserts the price is in none of them before the reveal.

### Robustness

- **Simultaneous last guesses:** scores are recomputed from all revealed rounds,
  never incremented, so a double reveal can't double-count.
- **Host leaves:** after 60 seconds with no progress, any player in the game can
  reveal or continue. The server checks the 60 seconds with its own clock.
- **Rejoin:** "New game" lists your games in progress, so clicking away never
  loses a game.

### Cost control

Each Amazon search costs about $0.03. Products are cached per category, and once
a category has 45 cached products the app never searches again. That's roughly
18 searches, about $0.60, for the app's whole life. Games built from the cache
are free. A per-user limit of 50 new games a day only guards against spam.

## Choices and tradeoffs

- **No AI.** Hints would need the model to know the price, which breaks the
  anti-cheat design. AI commentary adds latency and cost to every reveal without
  making the game better. AI-generated products would mean fake prices, which
  defeats "real products, real prices."
- **Server actions for every write** instead of client-side mutations. It's
  more code, but it's the only way to enforce game rules (phases, host,
  one guess per round) that row permissions can't express.
- **Cached products over fresh searches.** Prices can drift from Amazon's
  current price. Bounded, predictable cost was worth more.
- **Left out:** chat, avatars, payments, scheduled daily challenges. None of
  them make the core game better at this scope.

## What I'd do next

- Let players start the game if the host leaves while still in the lobby (today
  only rounds in progress have the host-away fallback).
- Refresh cached prices on a schedule (DeepSpace cron) so they don't drift.
- A daily solo challenge with a shared leaderboard.

## Run it yourself

```sh
npm install
npx deepspace auth login     # opens a browser
npx deepspace dev start      # local dev server
npx deepspace deploy         # deploy to <name>.app.space
```

## Tests

```sh
npm run test:unit              # rule tests (vitest)
npx deepspace test run all     # unit + browser tests
```

The browser tests need local test accounts (`npx deepspace test accounts create ...`).
They cover a two-player game including the price-leak check, a 4-player game with
simultaneous joins and guesses, the host-away fallback, and sign-in checks on
every action.

Development notes, including what the coding agent did and what was verified
by hand, are in [`docs/DEVLOG.md`](docs/DEVLOG.md).
