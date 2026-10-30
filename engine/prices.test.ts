import { describe, expect, it } from 'vitest'

import { resolveOffers } from './prices'
import { NOW, SETTINGS, daysAgo, flower, report } from './testkit/builders'

const rose = flower('rose')

describe('resolveOffers', () => {
  it('uses the newest report for a supplier', () => {
    const { offers } = resolveOffers(
      rose,
      [
        report('rose', 's1', 1000, 10, { reportedAt: daysAgo(5) }),
        report('rose', 's1', 1200, 10, { reportedAt: daysAgo(2) }),
        report('rose', 's1', 900, 10, { reportedAt: daysAgo(9) }),
      ],
      SETTINGS,
      NOW,
    )

    expect(offers.map((offer) => offer.pricePence)).toEqual([1200])
  })

  it('returns one offer per supplier, ordered by supplier id', () => {
    const { offers } = resolveOffers(
      rose,
      [report('rose', 's2', 1000, 10), report('rose', 's1', 1100, 10)],
      SETTINGS,
      NOW,
    )

    expect(offers.map((offer) => offer.supplierId)).toEqual(['s1', 's2'])
  })

  it('ignores reports for other flowers', () => {
    const { offers } = resolveOffers(rose, [report('tulip', 's1', 1000, 10)], SETTINGS, NOW)

    expect(offers).toEqual([])
  })

  it('falls back to the previous price when the newest is voided', () => {
    const { offers } = resolveOffers(
      rose,
      [
        report('rose', 's1', 1000, 10, { reportedAt: daysAgo(5) }),
        report('rose', 's1', 2000, 10, { reportedAt: daysAgo(1), status: 'voided' }),
      ],
      SETTINGS,
      NOW,
    )

    expect(offers[0]?.pricePence).toBe(1000)
  })

  it('falls back to the previous price when an offer has ended', () => {
    const { offers } = resolveOffers(
      rose,
      [
        report('rose', 's1', 1000, 10, { reportedAt: daysAgo(5) }),
        report('rose', 's1', 750, 10, { reportedAt: daysAgo(3), offerEndsAt: daysAgo(1) }),
      ],
      SETTINGS,
      NOW,
    )

    expect(offers[0]?.pricePence).toBe(1000)
  })

  it('still applies an offer at the exact moment it ends', () => {
    const { offers } = resolveOffers(
      rose,
      [report('rose', 's1', 750, 10, { offerEndsAt: NOW })],
      SETTINGS,
      NOW,
    )

    expect(offers[0]?.pricePence).toBe(750)
  })

  it('applies an offer that has not ended', () => {
    const { offers } = resolveOffers(
      rose,
      [report('rose', 's1', 750, 10, { offerEndsAt: '2026-07-30T00:00:00.000Z' })],
      SETTINGS,
      NOW,
    )

    expect(offers[0]?.pricePence).toBe(750)
  })

  it('breaks a timestamp tie by report id, highest first', () => {
    const when = daysAgo(1)
    const { offers } = resolveOffers(
      rose,
      [
        report('rose', 's1', 1000, 10, { id: 'r-a', reportedAt: when }),
        report('rose', 's1', 2000, 10, { id: 'r-b', reportedAt: when }),
      ],
      SETTINGS,
      NOW,
    )

    expect(offers[0]?.reportId).toBe('r-b')
  })

  it.each([
    [14, 'fresh'],
    [14.1, 'amber'],
    [30, 'amber'],
    [30.1, 'red'],
  ])('marks a price %d days old as %s', (age, freshness) => {
    const { offers } = resolveOffers(
      rose,
      [report('rose', 's1', 1000, 10, { reportedAt: daysAgo(age) })],
      SETTINGS,
      NOW,
    )

    expect(offers[0]?.freshness).toBe(freshness)
  })

  it('treats a stem-sold flower as a bunch of 1', () => {
    const { offers } = resolveOffers(
      flower('dahlia', 'stem'),
      [report('dahlia', 's1', 150, 0)],
      SETTINGS,
      NOW,
    )

    expect(offers[0]?.bunchSize).toBe(1)
  })

  it('reports no-price when nothing has been reported', () => {
    expect(resolveOffers(rose, [], SETTINGS, NOW)).toEqual({ offers: [], missing: 'no-price' })
  })

  it('reports no-price when every report is voided', () => {
    expect(
      resolveOffers(rose, [report('rose', 's1', 1000, 10, { status: 'voided' })], SETTINGS, NOW),
    ).toEqual({ offers: [], missing: 'no-price' })
  })

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 2.5],
  ])('reports no-bunch-size for a %s bunch size', (_label, size) => {
    expect(resolveOffers(rose, [report('rose', 's1', 1000, size)], SETTINGS, NOW)).toEqual({
      offers: [],
      missing: 'no-bunch-size',
    })
  })

  it.each([
    ['negative', -1],
    ['fractional', 10.5],
  ])('reports no-price for a %s price', (_label, price) => {
    expect(resolveOffers(rose, [report('rose', 's1', price, 10)], SETTINGS, NOW)).toEqual({
      offers: [],
      missing: 'no-price',
    })
  })

  it('accepts a price of zero', () => {
    const { offers } = resolveOffers(rose, [report('rose', 's1', 0, 10)], SETTINGS, NOW)

    expect(offers[0]?.pricePence).toBe(0)
  })

  it('does not reach behind a bad newest report to an older price', () => {
    const { offers, missing } = resolveOffers(
      rose,
      [
        report('rose', 's1', 1000, 10, { reportedAt: daysAgo(5) }),
        report('rose', 's1', 1200, 0, { reportedAt: daysAgo(1) }),
      ],
      SETTINGS,
      NOW,
    )

    expect(offers).toEqual([])
    expect(missing).toBe('no-bunch-size')
  })

  it('ignores a report with an unreadable date', () => {
    const { offers } = resolveOffers(
      rose,
      [report('rose', 's1', 1000, 10, { reportedAt: 'yesterday' })],
      SETTINGS,
      NOW,
    )

    expect(offers).toEqual([])
  })

  it('keeps a good supplier when another supplier has bad data', () => {
    const { offers, missing } = resolveOffers(
      rose,
      [report('rose', 's1', 1000, 0), report('rose', 's2', 1000, 10)],
      SETTINGS,
      NOW,
    )

    expect(offers.map((offer) => offer.supplierId)).toEqual(['s2'])
    expect(missing).toBeNull()
  })
})
