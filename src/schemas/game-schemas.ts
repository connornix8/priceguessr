/**
 * Price Guessr — game collections.
 *
 * Security model in one sentence: players can READ the public game state live,
 * but every WRITE goes through a server action (src/actions/index.ts), and the
 * real prices live in collections no player role can read at all.
 *
 * Because RBAC is enforced inside the Durable Object before anything is sent
 * over the WebSocket, a price stored in `answers` or `product_pool` never
 * reaches a browser — not even one with dev tools open.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

/** Everyone signed in can watch; nobody writes directly (server actions only). */
const READ_ONLY: Record<string, RolePermissions> = {
  member: { read: true, create: false, update: false, delete: false },
  admin: { read: true, create: false, update: false, delete: false },
}

/** Server-only data: no role can read or write it over the WebSocket. */
const SERVER_ONLY: Record<string, RolePermissions> = {
  member: { read: false, create: false, update: false, delete: false },
  admin: { read: false, create: false, update: false, delete: false },
}

/** One game room, found by its 4-letter code. */
export const gamesSchema: CollectionSchema = {
  name: 'games',
  columns: [
    { name: 'code', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hostId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'category', storage: 'text', interpretation: 'plain' },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['lobby', 'guessing', 'revealed', 'finished'] },
    },
    { name: 'roundIndex', storage: 'number', interpretation: 'plain' },
    { name: 'totalRounds', storage: 'number', interpretation: 'plain' },
  ],
  uniqueOn: ['code'],
  permissions: READ_ONLY,
}

/** A player in a game. Score is recomputed by the server on every reveal. */
export const playersSchema: CollectionSchema = {
  name: 'players',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'score', storage: 'number', interpretation: 'plain' },
    /** Index of the last round this player guessed in (-1 = none yet). */
    { name: 'guessedRound', storage: 'number', interpretation: 'plain' },
  ],
  uniqueOn: ['gameId', 'userId'],
  permissions: READ_ONLY,
}

/**
 * One round = one product. `price` and `results` stay empty until the reveal,
 * so the public row carries nothing a player could cheat with.
 */
export const roundsSchema: CollectionSchema = {
  name: 'rounds',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'index', storage: 'number', interpretation: 'plain' },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'image', storage: 'text', interpretation: { kind: 'url' } },
    { name: 'rating', storage: 'number', interpretation: 'plain' },
    { name: 'link', storage: 'text', interpretation: { kind: 'url' } },
    /** Real price in cents — written only at reveal time. */
    { name: 'price', storage: 'number', interpretation: 'plain' },
    /** Per-player results, written at reveal: { [userId]: { guess, points } } */
    { name: 'results', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: READ_ONLY,
}

/** The answer key: the real price for each round. Server-only. */
export const answersSchema: CollectionSchema = {
  name: 'answers',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'price', storage: 'number', interpretation: 'plain', required: true },
  ],
  permissions: SERVER_ONLY,
}

/** Players' guesses. Server-only until reveal, so nobody can copy a rival. */
export const guessesSchema: CollectionSchema = {
  name: 'guesses',
  columns: [
    { name: 'gameId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'roundId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    /** Guess in cents. */
    { name: 'amount', storage: 'number', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['roundId', 'userId'],
  permissions: SERVER_ONLY,
}

/**
 * Cached Amazon products, reused across games so we don't pay for a search
 * every time. Holds real prices, so it is server-only too.
 */
export const productPoolSchema: CollectionSchema = {
  name: 'product_pool',
  columns: [
    { name: 'category', storage: 'text', interpretation: 'plain', required: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'image', storage: 'text', interpretation: { kind: 'url' } },
    { name: 'rating', storage: 'number', interpretation: 'plain' },
    { name: 'link', storage: 'text', interpretation: { kind: 'url' } },
    { name: 'price', storage: 'number', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['category', 'title'],
  permissions: SERVER_ONLY,
}

export const gameSchemas = [
  gamesSchema,
  playersSchema,
  roundsSchema,
  answersSchema,
  guessesSchema,
  productPoolSchema,
]
