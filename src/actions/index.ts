/**
 * Price Guessr server actions — the ONLY way game data gets written.
 *
 * Each action is exposed at POST /api/actions/<name>. The worker verifies the
 * caller's JWT first, so `userId` here is trustworthy. Actions run with RBAC
 * off (they can read the hidden `answers` and `guesses`), which is exactly why
 * every action below checks the game rules itself before writing anything:
 * who is the host, is the game in the right phase, is the caller a player.
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  findCategory,
  guessToCents,
  ids,
  makeRoomCode,
  normalizeRoomCode,
  parsePriceToCents,
  ROUND_OPTIONS,
  scoreGuess,
  shuffle,
  type Category,
} from '../game/logic'

// ---------------------------------------------------------------------------
// Types for the rows we read back (fields live under `record.data`).
// ---------------------------------------------------------------------------

type GameStatus = 'lobby' | 'guessing' | 'revealed' | 'finished'

interface Game extends Record<string, unknown> {
  code: string
  hostId: string
  category: string
  status: GameStatus
  roundIndex: number
  totalRounds: number
}

interface Player extends Record<string, unknown> {
  gameId: string
  userId: string
  score: number
  guessedRound: number
}

interface PoolProduct extends Record<string, unknown> {
  category: string
  title: string
  image: string
  rating: number | null
  link: string
  price: number
}

interface RoundResult {
  guess: number
  points: number
}

/** Keep spend bounded: each new game may trigger one paid Amazon search. */
const MAX_GAMES_PER_USER_PER_DAY = 10
/** Once a category has this many cached products, stop searching Amazon. */
const POOL_TARGET = 45

const fail = (error: string): ActionResult<never> => ({ success: false, error })

// ---------------------------------------------------------------------------
// Small helpers around `tools`
// ---------------------------------------------------------------------------

async function loadGame(tools: ActionTools, gameId: unknown) {
  if (typeof gameId !== 'string' || !gameId) return null
  const res = await tools.get<Game>('games', gameId)
  return res.success ? res.data.record : null
}

async function loadPlayers(tools: ActionTools, gameId: string) {
  const res = await tools.query<Player>('players', { where: { gameId }, limit: 50 })
  return res.success ? res.data.records : []
}

/**
 * Make sure the category's cached product pool has enough products, buying one
 * Amazon search if it doesn't. Returns the pool.
 */
async function ensureProductPool(tools: ActionTools, category: Category, needed: number) {
  const load = async () => {
    const res = await tools.query<PoolProduct>('product_pool', {
      where: { category: category.id },
      limit: 500,
    })
    return res.success ? res.data.records.map((r) => r.data) : []
  }

  let pool = await load()
  if (pool.length >= Math.max(needed, POOL_TARGET)) return pool

  // Pick a search phrase we probably haven't used much yet.
  const query = category.queries[pool.length % category.queries.length]
  const search = await tools.integration<{ products: Array<Record<string, unknown>> }>(
    'amazon/search-products',
    { query, limit: 20 },
  )
  if (!search.success) {
    console.warn(`[pool] amazon search failed for ${category.id}: ${search.error}`)
    return pool // fall back to whatever is cached
  }

  const known = new Set(pool.map((p) => p.title))
  for (const item of search.data.products ?? []) {
    const price = parsePriceToCents(item.price)
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const image = typeof item.image === 'string' ? item.image : ''
    if (!price || !title || !image || known.has(title)) continue
    known.add(title)
    await tools.create<PoolProduct>('product_pool', {
      category: category.id,
      title,
      image,
      rating: typeof item.rating === 'number' ? item.rating : null,
      link: typeof item.link === 'string' ? item.link : '',
      price,
    })
  }
  pool = await load()
  return pool
}

async function generateUniqueCode(tools: ActionTools): Promise<string | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = makeRoomCode()
    const existing = await tools.query('games', { where: { code }, limit: 1 })
    if (existing.success && existing.data.count === 0) return code
  }
  return null
}

/**
 * Score the current round and publish the real price. Safe to run twice:
 * scores are recomputed from all revealed rounds, never incremented, so a
 * double reveal (two last guesses arriving together) can't double-count.
 */
async function revealCurrentRound(tools: ActionTools, gameId: string, game: Game) {
  const roundId = ids.round(gameId, game.roundIndex)

  const answer = await tools.get<{ price: number }>('answers', roundId)
  if (!answer.success) return fail('Answer missing for this round')
  const price = answer.data.record.data.price

  const guesses = await tools.query<{ userId: string; amount: number }>('guesses', {
    where: { roundId },
    limit: 50,
  })
  const results: Record<string, RoundResult> = {}
  if (guesses.success) {
    for (const g of guesses.data.records) {
      results[g.data.userId] = { guess: g.data.amount, points: scoreGuess(g.data.amount, price) }
    }
  }

  await tools.update('rounds', roundId, { price, results })
  await tools.update('games', gameId, { status: 'revealed' })

  // Recompute every player's total from all revealed rounds.
  const rounds = await tools.query<{ results: Record<string, RoundResult> | null }>('rounds', {
    where: { gameId },
    limit: 20,
  })
  const totals = new Map<string, number>()
  if (rounds.success) {
    for (const r of rounds.data.records) {
      for (const [uid, res] of Object.entries(r.data.results ?? {})) {
        totals.set(uid, (totals.get(uid) ?? 0) + res.points)
      }
    }
  }
  for (const p of await loadPlayers(tools, gameId)) {
    await tools.update('players', p.recordId, { score: totals.get(p.data.userId) ?? 0 })
  }
  return { success: true as const, data: { price } }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const actions: Record<string, ActionHandler<Env>> = {
  /** Create a room: pick products, hide their prices, add the host as player 1. */
  createGame: async ({ userId, params, tools }) => {
    const category = findCategory(params.category)
    if (!category) return fail('Unknown category')
    const totalRounds = Number(params.rounds)
    if (!ROUND_OPTIONS.includes(totalRounds as (typeof ROUND_OPTIONS)[number])) {
      return fail('Invalid number of rounds')
    }

    // Rate limit: at most N games per user in the last 24 hours.
    const recent = await tools.query<Game>('games', {
      where: { hostId: userId },
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: MAX_GAMES_PER_USER_PER_DAY,
    })
    if (recent.success && recent.data.records.length >= MAX_GAMES_PER_USER_PER_DAY) {
      const oldest = recent.data.records[recent.data.records.length - 1]
      if (Date.now() - Date.parse(oldest.createdAt) < 24 * 60 * 60 * 1000) {
        return fail(`Daily limit reached (${MAX_GAMES_PER_USER_PER_DAY} games). Try again tomorrow.`)
      }
    }

    const pool = await ensureProductPool(tools, category, totalRounds)
    if (pool.length < totalRounds) {
      return fail('Could not load enough products right now. Please try again in a moment.')
    }

    const code = await generateUniqueCode(tools)
    if (!code) return fail('Could not create a room code. Please try again.')

    const gameId = crypto.randomUUID()
    const picks = shuffle(pool).slice(0, totalRounds)

    // Answers first, so a round never exists without its hidden price.
    for (const [index, product] of picks.entries()) {
      const roundId = ids.round(gameId, index)
      await tools.create('answers', { gameId, price: product.price }, roundId)
      await tools.create(
        'rounds',
        {
          gameId,
          index,
          title: product.title,
          image: product.image,
          rating: product.rating,
          link: product.link,
          price: null,
          results: null,
        },
        roundId,
      )
    }

    await tools.create<Player>(
      'players',
      { gameId, userId, score: 0, guessedRound: -1 },
      ids.player(gameId, userId),
    )
    // The game row goes last: once it exists, everything it points to exists.
    const created = await tools.create<Game>(
      'games',
      { code, hostId: userId, category: category.id, status: 'lobby', roundIndex: 0, totalRounds },
      gameId,
    )
    if (!created.success) return fail(created.error)

    return { success: true, data: { gameId, code } }
  },

  /** Join a room by its code. Joining twice is harmless (same record id). */
  joinGame: async ({ userId, params, tools }) => {
    const code = normalizeRoomCode(params.code)
    if (!code) return fail('Room codes are 4 letters')

    const found = await tools.query<Game>('games', { where: { code }, limit: 1 })
    const game = found.success ? found.data.records[0] : undefined
    if (!game) return fail(`No room called ${code}`)
    if (game.data.status === 'finished') return fail('That game has already finished')

    const playerId = ids.player(game.recordId, userId)
    const existing = await tools.get('players', playerId)
    if (!existing.success) {
      const players = await loadPlayers(tools, game.recordId)
      if (players.length >= 12) return fail('That room is full')
      await tools.create<Player>(
        'players',
        { gameId: game.recordId, userId, score: 0, guessedRound: -1 },
        playerId,
      )
    }
    return { success: true, data: { gameId: game.recordId, code } }
  },

  /** Host only: leave the lobby and open round 1. */
  startGame: async ({ userId, params, tools }) => {
    const game = await loadGame(tools, params.gameId)
    if (!game) return fail('Game not found')
    if (game.data.hostId !== userId) return fail('Only the host can start the game')
    if (game.data.status !== 'lobby') return fail('The game has already started')

    await tools.update('games', game.recordId, { status: 'guessing', roundIndex: 0 })
    return { success: true, data: {} }
  },

  /** Lock in (or change) a guess for the current round. */
  submitGuess: async ({ userId, params, tools }) => {
    const game = await loadGame(tools, params.gameId)
    if (!game) return fail('Game not found')
    if (game.data.status !== 'guessing') return fail('Guessing is closed for this round')

    const amount = guessToCents(params.amount)
    if (amount === null) return fail('Enter a price between $0.01 and $100,000')

    const gameId = game.recordId
    const playerId = ids.player(gameId, userId)
    const me = await tools.get('players', playerId)
    if (!me.success) return fail('You are not in this game')

    const roundId = ids.round(gameId, game.data.roundIndex)
    await tools.create('guesses', { gameId, roundId, userId, amount }, ids.guess(roundId, userId))
    await tools.update('players', playerId, { guessedRound: game.data.roundIndex })

    // Everyone has guessed? Reveal automatically (this also makes solo play smooth).
    const players = await loadPlayers(tools, gameId)
    const allIn = players.every(
      (p) => p.data.userId === userId || p.data.guessedRound === game.data.roundIndex,
    )
    if (allIn) {
      const fresh = await loadGame(tools, gameId)
      if (fresh?.data.status === 'guessing') await revealCurrentRound(tools, gameId, fresh.data)
    }
    return { success: true, data: { revealed: allIn } }
  },

  /** Host only: reveal now, without waiting for stragglers. */
  revealRound: async ({ userId, params, tools }) => {
    const game = await loadGame(tools, params.gameId)
    if (!game) return fail('Game not found')
    if (game.data.hostId !== userId) return fail('Only the host can reveal')
    if (game.data.status !== 'guessing') return fail('This round is already revealed')
    return revealCurrentRound(tools, game.recordId, game.data)
  },

  /** Host only: move to the next round, or finish after the last one. */
  nextRound: async ({ userId, params, tools }) => {
    const game = await loadGame(tools, params.gameId)
    if (!game) return fail('Game not found')
    if (game.data.hostId !== userId) return fail('Only the host can continue')
    if (game.data.status !== 'revealed') return fail('Reveal this round first')

    const next = game.data.roundIndex + 1
    if (next >= game.data.totalRounds) {
      await tools.update('games', game.recordId, { status: 'finished' })
    } else {
      await tools.update('games', game.recordId, { status: 'guessing', roundIndex: next })
    }
    return { success: true, data: {} }
  },
}
