import { describe, expect, it } from 'vitest'

import type { Offer, OfferResolution } from './prices'
import { chooseSupplier, costToCover } from './suppliers'

function offer(
  supplierId: string,
  pricePence: number,
  bunchSize: number,
  extra: Partial<Offer> = {},
) {
  return {
    supplierId,
    reportId: `report-${supplierId}`,
    pricePence,
    bunchSize,
    reportedAt: '2026-06-29T12:00:00.000Z',
    ageDays: 1,
    freshness: 'fresh',
    ...extra,
  } satisfies Offer
}

function stale(supplierId: string, pricePence: number, bunchSize: number, ageDays = 40) {
  return offer(supplierId, pricePence, bunchSize, {
    freshness: 'red',
    ageDays,
    reportedAt: `2026-05-${String(60 - ageDays).padStart(2, '0')}T12:00:00.000Z`,
  })
}

function resolution(...offers: Offer[]): OfferResolution {
  return { offers, missing: null }
}

describe('costToCover', () => {
  it('rounds up to whole bunches', () => {
    expect(costToCover('bunch', offer('s', 1000, 10), 21)).toBe(3000)
  })

  it('charges per stem for stem-sold flowers', () => {
    expect(costToCover('stem', offer('s', 150, 1), 7)).toBe(1050)
  })
})

describe('chooseSupplier', () => {
  it('picks the lowest actual cost, not the lowest price per stem', () => {
    const decision = chooseSupplier(
      'bunch',
      12,
      resolution(offer('big', 3000, 48), offer('small', 1000, 10)),
    )

    expect(decision.offer?.supplierId).toBe('small')
  })

  it('breaks a cost tie by supplier id', () => {
    const decision = chooseSupplier(
      'bunch',
      5,
      resolution(offer('b', 1000, 10), offer('a', 1000, 10)),
    )

    expect(decision.offer?.supplierId).toBe('a')
  })

  it('prices a flower with no pre-floating stems as if it needs 1 stem', () => {
    const decision = chooseSupplier(
      'bunch',
      0,
      resolution(offer('a', 2000, 10), offer('b', 1000, 10)),
    )

    expect(decision.offer?.supplierId).toBe('b')
  })

  it('does not let a stale price win over a fresh one', () => {
    const decision = chooseSupplier(
      'bunch',
      5,
      resolution(stale('cheap', 100, 10), offer('dear', 1000, 10)),
    )

    expect(decision.offer?.supplierId).toBe('dear')
  })

  it('lists cheaper stale prices as flagged alternatives', () => {
    const decision = chooseSupplier(
      'bunch',
      5,
      resolution(stale('cheap', 100, 10), stale('dearer', 5000, 10), offer('fresh', 1000, 10)),
    )

    expect(decision.staleAlternatives.map((alt) => alt.supplierId)).toEqual(['cheap'])
  })

  it('uses the newest price when only stale ones exist', () => {
    const decision = chooseSupplier(
      'bunch',
      5,
      resolution(stale('old', 100, 10, 50), stale('newer', 900, 10, 35)),
    )

    expect(decision.offer?.supplierId).toBe('newer')
    expect(decision.staleAlternatives.map((alt) => alt.supplierId)).toEqual(['old'])
  })

  it('treats an amber price as usable', () => {
    const decision = chooseSupplier(
      'bunch',
      5,
      resolution(offer('amber', 100, 10, { freshness: 'amber' }), offer('fresh', 1000, 10)),
    )

    expect(decision.offer?.supplierId).toBe('amber')
  })

  it('lets an override beat a cheaper supplier', () => {
    const decision = chooseSupplier(
      'bunch',
      5,
      resolution(offer('cheap', 100, 10), offer('mine', 1000, 10)),
      'mine',
    )

    expect(decision.offer?.supplierId).toBe('mine')
  })

  it('lets an override use a stale price', () => {
    const decision = chooseSupplier(
      'bunch',
      5,
      resolution(stale('mine', 100, 10), offer('other', 1000, 10)),
      'mine',
    )

    expect(decision.offer?.supplierId).toBe('mine')
  })

  it('reports needs data rather than switching when an override has no price', () => {
    const decision = chooseSupplier('bunch', 5, resolution(offer('other', 1000, 10)), 'gone')

    expect(decision).toEqual({
      offer: null,
      missing: 'override-unavailable',
      staleAlternatives: [],
    })
  })

  it('passes on why a flower has no offers', () => {
    const decision = chooseSupplier('bunch', 5, { offers: [], missing: 'no-bunch-size' })

    expect(decision).toEqual({ offer: null, missing: 'no-bunch-size', staleAlternatives: [] })
  })
})
