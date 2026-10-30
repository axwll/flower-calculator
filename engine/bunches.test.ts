import { describe, expect, it } from 'vitest'

import { calculatePurchase } from './bunches'
import type { Offer } from './prices'
import { flower } from './testkit/builders'

function offer(pricePence: number, bunchSize: number): Offer {
  return {
    supplierId: 's',
    reportId: 'r',
    pricePence,
    bunchSize,
    reportedAt: '2026-06-29T12:00:00.000Z',
    ageDays: 1,
    freshness: 'fresh',
  }
}

describe('calculatePurchase', () => {
  it('rounds bunch flowers up and counts spare stems', () => {
    expect(calculatePurchase(flower('a'), 39, offer(4000, 48), 15)).toEqual({
      bunches: 1,
      spare: 9,
      costPence: 4000,
      thinBunch: null,
    })
  })

  it('has no spare stems on an exact multiple', () => {
    expect(calculatePurchase(flower('a'), 20, offer(700, 10), 15)).toMatchObject({
      bunches: 2,
      spare: 0,
      costPence: 1400,
    })
  })

  it('charges stem-sold flowers exactly, with no spare stems', () => {
    expect(calculatePurchase(flower('a', 'stem'), 7, offer(150, 1), 15)).toEqual({
      bunches: 0,
      spare: 0,
      costPence: 1050,
      thinBunch: null,
    })
  })

  it('makes foraged flowers free with no spare stems', () => {
    expect(calculatePurchase(flower('a', 'foraged'), 12, null, 15)).toEqual({
      bunches: 0,
      spare: 0,
      costPence: 0,
      thinBunch: null,
    })
  })

  it('excludes cost when there is no offer', () => {
    expect(calculatePurchase(flower('a'), 12, null, 15)).toEqual({
      bunches: 0,
      spare: 0,
      costPence: 0,
      thinBunch: null,
    })
  })

  it('buys nothing for a flower with no stems', () => {
    expect(calculatePurchase(flower('a'), 0, offer(700, 10), 15)).toEqual({
      bunches: 0,
      spare: 0,
      costPence: 0,
      thinBunch: null,
    })
  })

  it.each([
    [48, 48 + 7, 7],
    [20, 20 + 3, 3],
    [10, 10 + 1, 1],
  ])('warns at the threshold for a bunch of %i', (size, stems, lastUsed) => {
    expect(calculatePurchase(flower('a'), stems, offer(100, size), 15).thinBunch).toEqual({
      lastBunchStems: lastUsed,
      bunchSize: size,
    })
  })

  it.each([
    [48, 48 + 8],
    [20, 20 + 4],
    [10, 10 + 2],
  ])('does not warn one stem over the threshold for a bunch of %i', (size, stems) => {
    expect(calculatePurchase(flower('a'), stems, offer(100, size), 15).thinBunch).toBeNull()
  })

  it('warns when a single bunch is barely used', () => {
    expect(calculatePurchase(flower('a'), 2, offer(100, 20), 15).thinBunch).toEqual({
      lastBunchStems: 2,
      bunchSize: 20,
    })
  })

  it('does not warn when the last bunch is fully used', () => {
    expect(calculatePurchase(flower('a'), 1, offer(100, 1), 100).thinBunch).toBeNull()
  })

  it('skips the warning when leftovers are not tracked', () => {
    const untracked = flower('a', 'bunch', { trackLeftovers: false })

    expect(calculatePurchase(untracked, 11, offer(100, 10), 15).thinBunch).toBeNull()
  })

  it('uses whole-number percent maths where floats would be wrong', () => {
    expect(calculatePurchase(flower('a'), 29, offer(100, 100), 29).thinBunch).toEqual({
      lastBunchStems: 29,
      bunchSize: 100,
    })
  })
})
