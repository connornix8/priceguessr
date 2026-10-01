import { describe, expect, it } from 'vitest'
import {
  guessToCents,
  makeRoomCode,
  normalizeRoomCode,
  parsePriceToCents,
  scoreGuess,
  shuffle,
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
