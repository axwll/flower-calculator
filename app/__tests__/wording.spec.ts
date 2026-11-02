import { describe, expect, it } from 'vitest'

import { daysUntilText, groupPounds, placementText, purchaseChangeText } from '../wording'

function flower(perPlacement: number[], ranges: { from: number; to: number; stems: number }[]) {
  return { perPlacement, ranges }
}

describe('placementText', () => {
  it('gives the plain count for a single placement', () => {
    expect(placementText(flower([5], [{ from: 1, to: 1, stems: 5 }]))).toBe('5')
  })

  it('says each when every placement matches', () => {
    expect(placementText(flower([4, 4, 4], [{ from: 1, to: 3, stems: 4 }]))).toBe('4 each')
  })

  it('words the plan’s scabious example', () => {
    expect(
      placementText(
        flower(
          [2, 2, 2, 1, 1, 1, 1],
          [
            { from: 1, to: 3, stems: 2 },
            { from: 4, to: 7, stems: 1 },
          ],
        ),
      ),
    ).toBe('2 each for 1 to 3, 1 each for 4 to 7')
  })

  it('words a wrapped range and single placements', () => {
    expect(
      placementText(
        flower(
          [1, 2, 2, 1],
          [
            { from: 1, to: 1, stems: 1 },
            { from: 2, to: 3, stems: 2 },
            { from: 4, to: 4, stems: 1 },
          ],
        ),
      ),
    ).toBe('1 for 1, 2 each for 2 to 3, 1 for 4')
  })

  it('leaves out placements with no stems', () => {
    expect(
      placementText(
        flower(
          [1, 1, 0, 0, 0],
          [
            { from: 1, to: 2, stems: 1 },
            { from: 3, to: 5, stems: 0 },
          ],
        ),
      ),
    ).toBe('1 each for 1 to 2')
  })

  it('handles one stem in one of several placements', () => {
    expect(
      placementText(
        flower(
          [0, 0, 1],
          [
            { from: 1, to: 2, stems: 0 },
            { from: 3, to: 3, stems: 1 },
          ],
        ),
      ),
    ).toBe('1 for 3')
  })
})

describe('groupPounds', () => {
  it.each([
    ['', ''],
    ['999', '999'],
    ['1000', '1,000'],
    ['1,00', '100'],
    ['1000000', '1,000,000'],
    ['1000.', '1,000.'],
    ['1000.50', '1,000.50'],
    ['.5', '.5'],
    ['£2500', '£2,500'],
    ['twelve', 'twelve'],
    ['1.2.3', '1.2.3'],
  ])('turns "%s" into "%s"', (text, expected) => {
    expect(groupPounds(text)).toBe(expected)
  })
})

describe('daysUntilText', () => {
  const now = new Date(2026, 10, 2, 23, 30)

  it.each([
    ['2026-11-02', 'today'],
    ['2026-11-03', 'tomorrow'],
    ['2026-11-01', 'yesterday'],
    ['2026-11-30', 'in 28 days'],
    ['2026-10-30', '3 days ago'],
    ['2027-11-02', 'in 365 days'],
  ])('%s is %s', (date, expected) => {
    expect(daysUntilText(date, now)).toBe(expected)
  })
})

describe('purchaseChangeText', () => {
  const names = { flowerName: () => 'Rose', designName: () => '', supplierName: () => '' }
  const change = {
    flowerId: 'rose',
    kind: 'added',
    before: 0,
    after: 2,
    addedCostPence: 0,
  } as const

  it('counts in bunches when bought by the bunch', () => {
    expect(purchaseChangeText({ ...change, unit: 'bunch' }, names)).toBe(
      'Rose: 2 bunches added after purchase.',
    )
  })

  it('counts in stems otherwise', () => {
    expect(purchaseChangeText({ ...change, unit: 'stem' }, names)).toBe(
      'Rose: 2 stems added after purchase.',
    )
  })
})
