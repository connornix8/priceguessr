import { describe, expect, it } from 'vitest'
import {
  guessToCents,
  makeRoomCode,
  normalizeRoomCode,
  parsePriceToCents,
  scoreGuess,
  shuffle,
  verdictFor,
  canControlGame,
  HOST_AWAY_MS,
} from './logic'

describe('parsePriceToCents', () => {
  it('parses normal Amazon prices', () => {
    expect(parsePriceToCents('$23.99')).toBe(2399)
    expect(parsePriceToCents('$1,249.99')).toBe(124999)
    expect(parsePriceToCents('$5')).toBe(500)
  })
  it('rejects missing, zero, or odd formats', () => {
    expect(parsePriceToCents('')).toBeNull()
    expect(parsePriceToCents('$0.00')).toBeNull()
    expect(parsePriceToCents('$10.99 - $20.99')).toBeNull()
    expect(parsePriceToCents(undefined)).toBeNull()
  })
})

describe('guessToCents', () => {
  it('accepts sensible guesses', () => {
    expect(guessToCents(19.99)).toBe(1999)
    expect(guessToCents('42')).toBe(4200)
  })
  it('rejects nonsense', () => {
    expect(guessToCents(0)).toBeNull()
    expect(guessToCents(-5)).toBeNull()
    expect(guessToCents('abc')).toBeNull()
    expect(guessToCents(1_000_000)).toBeNull()
    expect(guessToCents(0.004)).toBeNull() // would round to $0.00
  })
})

describe('scoreGuess', () => {
  it('gives 1000 for an exact guess', () => {
    expect(scoreGuess(2399, 2399)).toBe(1000)
  })
  it('scores by percentage off, either direction', () => {
    expect(scoreGuess(1500, 2000)).toBe(750) // 25% low
    expect(scoreGuess(2500, 2000)).toBe(750) // 25% high
  })
  it('never goes below zero', () => {
    expect(scoreGuess(10000, 2000)).toBe(0)
  })
})

describe('room codes', () => {
  it('makes 4 letters without I or O', () => {
    for (let i = 0; i < 200; i++) expect(makeRoomCode()).toMatch(/^[A-HJ-NP-Z]{4}$/)
  })
  it('normalizes typed codes', () => {
    expect(normalizeRoomCode(' abcd ')).toBe('ABCD')
    expect(normalizeRoomCode('AB1D')).toBeNull()
    expect(normalizeRoomCode('ABCDE')).toBeNull()
  })
})

describe('shuffle', () => {
  it('keeps the same items', () => {
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4])
  })
})

describe('verdictFor', () => {
  it('describes how far off and in which direction', () => {
    expect(verdictFor(7900, 6499)).toMatchObject({ label: 'Not bad', detail: 'You were 22% too high' })
    expect(verdictFor(6000, 6499)).toMatchObject({ label: 'So close!', detail: 'You were 8% too low' })
    expect(verdictFor(6499, 6499)).toMatchObject({ label: 'Spot on!', detail: 'You nailed the exact price' })
    expect(verdictFor(20000, 6499)).toMatchObject({ label: 'Way off…', tone: 'bad' })
  })
})

describe('canControlGame', () => {
  it('always lets the host act', () => {
    expect(canControlGame({ isHost: true, isPlayer: true, idleMs: 0 })).toBe(true)
  })
  it('lets other players act only after the host has been away a while', () => {
    expect(canControlGame({ isHost: false, isPlayer: true, idleMs: HOST_AWAY_MS - 1 })).toBe(false)
    expect(canControlGame({ isHost: false, isPlayer: true, idleMs: HOST_AWAY_MS })).toBe(true)
  })
  it('never lets a non-player act', () => {
    expect(canControlGame({ isHost: false, isPlayer: false, idleMs: HOST_AWAY_MS * 10 })).toBe(false)
  })
})
