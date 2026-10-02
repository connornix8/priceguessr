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
