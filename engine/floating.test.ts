import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { placeFloating, scorePlacement } from './floating'
import type { FloatingFlower, FloatingLine } from './floating'
import { bruteForceBest } from './testkit/bruteForce'

function bunch(stems: number, bunchSize: number, pricePence = 1000): FloatingFlower {
  return { soldAs: 'bunch', stems, bunchSize, pricePence }
}
const stem = (stems: number, pricePence = 100): FloatingFlower => ({
  soldAs: 'stem',
  stems,
  bunchSize: 1,
  pricePence,
})
const foraged = (stems: number): FloatingFlower => ({
  soldAs: 'foraged',
  stems,
  bunchSize: null,
  pricePence: null,
})
const needsData = (stems: number): FloatingFlower => ({
  soldAs: 'bunch',
  stems,
  bunchSize: null,
  pricePence: null,
})

function place(lines: FloatingLine[], flowers: Record<string, FloatingFlower>): string[][] {
  return placeFloating(lines, new Map(Object.entries(flowers)))
}

describe('placeFloating priorities', () => {
  it('prefers a bunch flower with spare stems over a free foraged flower', () => {
    expect(
      place([{ eligibleFlowerIds: ['fern', 'rose'], floating: 1 }], {
        fern: foraged(3),
        rose: bunch(9, 10),
      }),
    ).toEqual([['rose']])
  })

  it('takes the bunch flower with the most spare stems', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], { a: bunch(8, 10), b: bunch(5, 10) }),
    ).toEqual([['b']])
  })

  it('prefers foraged over stem-sold', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], { a: stem(1), b: foraged(1) }),
    ).toEqual([['b']])
  })

  it('prefers stem-sold over opening a new bunch', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], { a: bunch(10, 10), b: stem(1) }),
    ).toEqual([['b']])
  })

  it('opens the bunch with the lowest added cost', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], {
        a: bunch(10, 10, 2000),
        b: bunch(10, 10, 900),
      }),
    ).toEqual([['b']])
  })

  it('breaks an added-cost tie by smallest bunch', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], {
        a: bunch(20, 20, 900),
        b: bunch(10, 10, 900),
      }),
    ).toEqual([['b']])
  })

  it('breaks a full tie by flower id', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], {
        a: bunch(10, 10),
        b: bunch(10, 10),
      }),
    ).toEqual([['a']])
  })

  it('uses a needs-data flower only when nothing else is left', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b', 'c'], floating: 2 }], {
        a: needsData(5),
        b: bunch(10, 10),
        c: needsData(5),
      }),
    ).toEqual([['a', 'b'].sort()])
  })

  it('never gives one line two floating stems on the same flower', () => {
    const [choice] = place([{ eligibleFlowerIds: ['a', 'b', 'c'], floating: 2 }], {
      a: bunch(1, 48),
      b: bunch(10, 10),
      c: bunch(10, 10),
    })

    expect(new Set(choice).size).toBe(2)
  })

  it('tracks spare stems across lines', () => {
    expect(
      place(
        [
          { eligibleFlowerIds: ['a', 'b'], floating: 1 },
          { eligibleFlowerIds: ['a', 'c'], floating: 1 },
        ],
        { a: bunch(9, 10), b: bunch(10, 10), c: bunch(9, 10) },
      ),
    ).toEqual([['a'], ['c']])
  })

  it('returns an empty choice for a line with no floating stems', () => {
    expect(place([{ eligibleFlowerIds: ['a'], floating: 0 }], { a: bunch(1, 10) })).toEqual([[]])
  })

  it('does not change the flowers passed in', () => {
    const flowers = new Map([['a', bunch(9, 10)]])
    placeFloating([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], flowers.set('b', bunch(9, 10)))

    expect(flowers.get('a')?.stems).toBe(9)
    expect(flowers.get('b')?.stems).toBe(9)
  })
})

describe('scorePlacement', () => {
  it('counts spare stems, cost and needs-data stems', () => {
    const flowers = new Map([
      ['a', bunch(9, 10, 500)],
      ['b', stem(2, 100)],
      ['c', foraged(4)],
      ['d', needsData(3)],
    ])

    expect(scorePlacement(flowers, [['a', 'b', 'd']])).toEqual({
      needsDataStems: 4,
      spare: 0,
      cost: 800,
    })
  })
})

const flowerArbitrary = fc.oneof(
  fc.record({
    soldAs: fc.constant('bunch' as const),
    stems: fc.integer({ min: 0, max: 30 }),
    bunchSize: fc.constantFrom(5, 10, 20, 48),
    pricePence: fc.integer({ min: 100, max: 5000 }),
  }),
  fc.record({
    soldAs: fc.constant('stem' as const),
    stems: fc.integer({ min: 0, max: 30 }),
    bunchSize: fc.constant(1),
    pricePence: fc.integer({ min: 10, max: 500 }),
  }),
  fc.record({
    soldAs: fc.constant('foraged' as const),
    stems: fc.integer({ min: 0, max: 30 }),
    bunchSize: fc.constant(null),
    pricePence: fc.constant(null),
  }),
  fc.record({
    soldAs: fc.constant('bunch' as const),
    stems: fc.integer({ min: 0, max: 30 }),
    bunchSize: fc.constant(null),
    pricePence: fc.constant(null),
  }),
)

const IDS = ['a', 'b', 'c', 'd', 'e']

const caseArbitrary = fc
  .record({
    flowers: fc.array(flowerArbitrary, { minLength: 5, maxLength: 5 }),
    lines: fc.array(
      fc.uniqueArray(fc.constantFrom(...IDS), { minLength: 2, maxLength: 5 }).chain((eligible) =>
        fc.record({
          eligibleFlowerIds: fc.constant([...eligible].sort()),
          floating: fc.integer({ min: 1, max: eligible.length - 1 }),
        }),
      ),
      { minLength: 1, maxLength: 3 },
    ),
  })
  .map(({ flowers, lines }) => ({
    lines,
    flowers: new Map(IDS.map((id, index) => [id, flowers[index] as FloatingFlower])),
  }))

describe('placeFloating against brute force', () => {
  it('looks ahead when an early line would waste a later saving', () => {
    // Greedy gives line 1 to the free fern, but line 2 then has nowhere cheap to go.
    const flowers = {
      fern: foraged(0),
      rose: bunch(0, 5, 100),
      tulip: needsData(0),
    }
    const lines = [
      { eligibleFlowerIds: ['fern', 'rose'], floating: 1 },
      { eligibleFlowerIds: ['rose', 'tulip'], floating: 1 },
    ]

    expect(place(lines, flowers)).toEqual([['rose'], ['rose']])
  })

  it('keeps the priority order when search finds nothing strictly better', () => {
    expect(
      place([{ eligibleFlowerIds: ['a', 'b'], floating: 1 }], { a: bunch(9, 10), b: bunch(9, 10) }),
    ).toEqual([['a']])
  })

  it('falls back to the priority rules on very large cases', () => {
    const lines = Array.from({ length: 40 }, () => ({
      eligibleFlowerIds: ['a', 'b', 'c'],
      floating: 2,
    }))
    const placement = place(lines, { a: bunch(1, 10), b: bunch(1, 10), c: stem(0) })

    expect(placement).toHaveLength(40)
    expect(placement.every((choice) => new Set(choice).size === 2)).toBe(true)
  })

  it('is never beaten on small cases', () => {
    fc.assert(
      fc.property(caseArbitrary, ({ lines, flowers }) => {
        expect(scorePlacement(flowers, placeFloating(lines, flowers))).toEqual(
          bruteForceBest(lines, flowers),
        )
      }),
      { numRuns: 2000 },
    )
  })
})
