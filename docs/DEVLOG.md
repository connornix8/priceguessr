# Dev log

Running notes for the submission writeup: what the coding agent did, and what
was checked or changed after testing.

## Day 1 (Sep 30)

- Chose the idea and scope: multiplayer price-guessing game on real Amazon
  products. Deliberately left out AI, chat, scheduled daily challenges.
- Agent scaffolded the app, connected the private GitHub repo before the first
  deploy (GitHub became the permanent source of truth), deployed the starter.
- Agent made one real Amazon search to inspect the data format before coding.
- Agent built schemas, server actions, and UI. Key design: real prices live in
  server-only collections; all writes go through server actions.
- Automated checks: unit tests for scoring rules; two-browser end-to-end test,
  including a check that the price is in none of the WebSocket messages a
  player receives before the reveal.

## Day 2 (Oct 1–2)

- Owner play-tested on the live site. Feedback: the room code ("DCDL") was
  unexplained; "Play" in the nav looked like it would abandon the game.
- Changes from that feedback: labelled room code + copy button, round progress
  dots, reveal verdict ("So close! 8% too low"), points out of 1000, guess bar,
  "Earlier this game" recap, nav renamed "New game", "Your games in progress"
  list with Rejoin links.
- Bug found in screenshots: all progress dots showed as done. Cause: unrevealed
  rounds weren't recognized as unrevealed. Fixed with a stricter check.
- Tradeoff changed after testing: a 10-games/day limit blocked the test
  account. Amazon spend is already capped by the product cache (~$0.60 total),
  so the per-user limit only needs to stop spam: raised to 50/day.
- Removed unused starter pages (API status, settings) and their flaky test.

## Day 3 (Oct 2)

- Owner asked: emojis or icons? Switched categories to Lucide icons (matches
  the rest of the UI, renders the same on every OS, follows theme colors).
- Owner asked: does the invite hold up with more people? Added a 4-player test:
  simultaneous joins, simultaneous guesses, a mid-round joiner. Passed 4/4.
  The test itself was wrong twice first (each screen says "You"; it read
  scores before they arrived). Two hypotheses (test timing vs. scoring bug)
  were separated by making the test wait: timing, not a bug.
- Found a real gap: if the host leaves, nobody can continue. Owner approved a
  fix: after 60s with no progress, any player in the game can reveal or
  continue. The server checks the 60s with its own clock. Covered by unit
  tests and a slow end-to-end test that closes the host's browser.

## Day 5 (Oct 5)

- Owner asked whether to add an AI feature. Decided no: hints would need the
  model to know the price (breaks anti-cheat), commentary adds cost and delay,
  generated products mean fake prices.
- Checked DeepSpace's careers FAQ after conflicting advice: AI coding tools are
  explicitly allowed ("We want to understand how you use AI tools").
- Agent wrote the README; owner rewrites the submission note in their own words.
