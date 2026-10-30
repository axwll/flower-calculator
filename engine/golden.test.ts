import { describe, expect, it } from 'vitest'

import { allocate } from './allocate'
import type { AllocationResult } from './results'
import { bridalInput, edgeCasesInput, receptionInput } from './testkit/fixtures'

// Expected figures are worked out by hand from Appendix A of docs/PLAN.md, not copied from
// engine output. Values that await confirmation are listed in each fixture's notes.

function summary(result: AllocationResult) {
  return Object.fromEntries(
    result.flowers.map((item) => [
      item.flowerId,
      [item.stems, item.bunches, item.spare, item.costPence],
    ]),
  )
}

function warningsWith(result: AllocationResult, code: string) {
  return result.warnings.filter((warning) => warning.code === code)
}

describe('bridal fixture', () => {
  const result = allocate(bridalInput)

  it('matches the recipe arithmetic for every flower', () => {
    expect(summary(result)).toEqual({
      'dahlia-dark': [18, 0, 0, 0],
      'dahlia-orange': [20, 0, 0, 0],
      'dahlia-peachy': [17, 0, 0, 0],
      'focus-rose': [39, 1, 9, 4000],
      'ms-rose': [17, 2, 3, 1600],
      santini: [10, 1, 20, 2400],
      scabious: [47, 0, 0, 0],
      'spray-carnation': [8, 1, 2, 600],
      'wax-flower': [13, 1, 35, 3000],
    })
  })

  it('agrees with the 9 focus roses left over on the paper', () => {
    expect(result.flowers.find((item) => item.flowerId === 'focus-rose')?.spare).toBe(9)
  })

  it('adds up the totals', () => {
    expect(result.totals).toEqual({
      stems: 189,
      unassignedStems: 0,
      spareStems: 69,
      spareCostPence: 750 + 240 + 120 + 1600 + 2188,
      costPence: 11600,
      needsDataFlowers: 4,
    })
  })

  it('flags only the flowers with no bunch size', () => {
    expect(
      warningsWith(result, 'needs-data').map((item) => 'flowerId' in item && item.flowerId),
    ).toEqual(['dahlia-dark', 'dahlia-orange', 'dahlia-peachy', 'scabious'])
    expect(result.warnings).toHaveLength(4)
  })

  it('deals seven bridesmaids an even share', () => {
    const bridesmaids = result.designs.find((item) => item.designId === 'bridesmaid-bouquet')

    expect(bridesmaids?.lines[0]?.flowers[0]).toMatchObject({
      flowerId: 'focus-rose',
      stems: 28,
      ranges: [{ from: 1, to: 7, stems: 4 }],
    })
  })
})

describe('reception fixture', () => {
  const result = allocate(receptionInput)

  it('matches the recipe arithmetic for every flower', () => {
    expect(summary(result)).toEqual({
      alstroemeria: [53, 3, 7, 3600],
      'burgundy-carnation': [50, 5, 0, 3500],
      'chrysanthemum-blooms': [11, 1, 9, 1800],
      'focus-rose': [9, 1, 39, 4000],
      hydrangea: [25, 1, 10, 7000],
      lisianthus: [16, 1, 4, 2200],
      'orange-rose': [17, 1, 43, 3600],
      santini: [53, 2, 7, 4800],
      sunflower: [10, 0, 0, 0],
    })
  })

  it('accounts for every recipe stem', () => {
    expect(result.totals).toMatchObject({ stems: 244, unassignedStems: 0, spareStems: 119 })
  })

  it('costs the cheaper supplier', () => {
    const alstroemeria = result.flowers.find((item) => item.flowerId === 'alstroemeria')

    expect(alstroemeria?.offer?.supplierId).toBe('wholesaler-a')
    expect(result.totals.costPence).toBe(30500)
  })

  it('splits filler strictly on every line', () => {
    const pumpkins = result.designs.find((item) => item.designId === 'pumpkin')

    expect(pumpkins?.lines[0]?.flowers.map((item) => item.stems)).toEqual([20, 20, 20])
  })

  it('reports the vase pool for information', () => {
    const [pool] = result.leftoverPools

    expect(pool).toMatchObject({ designId: 'table-vases', quantity: 11, totalSpare: 119 })
    expect(pool?.flowers.find((item) => item.flowerId === 'focus-rose')).toEqual({
      flowerId: 'focus-rose',
      spare: 39,
      perPlacement: 39 / 11,
    })
  })

  it('leaves the vases out of cost per design', () => {
    expect(result.designs.map((item) => item.designId)).not.toContain('table-vases')
    expect(result.designs.reduce((sum, item) => sum + item.costPence, 0)).toBe(30500)
  })
})

describe('edge-case fixture', () => {
  const result = allocate(edgeCasesInput)
  const find = (id: string) => result.flowers.find((item) => item.flowerId === id)

  it('matches hand-worked figures for every flower', () => {
    expect(summary(result)).toEqual({
      dahlia: [2, 0, 0, 300],
      fern: [13, 0, 0, 0],
      lily: [9, 1, 1, 2000],
      peony: [6, 1, 4, 900],
      rose: [17, 2, 3, 2000],
      statice: [11, 2, 9, 1000],
      thistle: [2, 0, 0, 0],
      tulip: [5, 1, 5, 600],
    })
  })

  it('ignores an offer that has ended', () => {
    expect(find('lily')?.offer?.reportId).toBe('e1')
  })

  it('flags a stale price when it is the only one', () => {
    expect(warningsWith(result, 'stale-price')).toMatchObject([{ flowerId: 'tulip' }])
  })

  it('shows a cheaper stale price without using it', () => {
    expect(find('peony')?.offer?.supplierId).toBe('s1')
    expect(find('peony')?.staleAlternatives.map((item) => item.reportId)).toEqual(['e6'])
  })

  it('puts the foraged flower on the gather list', () => {
    expect(result.gatherList).toEqual([{ flowerId: 'fern', stems: 13 }])
  })

  it('warns about the thin bunch', () => {
    expect(warningsWith(result, 'thin-bunch')).toMatchObject([
      { flowerId: 'statice', lastBunchStems: 1 },
    ])
  })

  it('marks the flower with no price as needs data', () => {
    expect(warningsWith(result, 'needs-data')).toMatchObject([{ flowerId: 'thistle', stems: 2 }])
  })

  it('reports the role with no ticked flowers', () => {
    expect(warningsWith(result, 'no-flowers-for-role')).toMatchObject([
      { designId: 'arch', role: 'accent', stems: 6 },
    ])
    expect(result.totals).toMatchObject({ stems: 65, unassignedStems: 6, costPence: 6800 })
  })

  it('treats each size as its own recipe', () => {
    const pedestals = result.designs.filter((item) => item.designId === 'pedestal')

    expect(pedestals.map((item) => [item.size, item.lines.length])).toEqual([
      ['Small', 2],
      ['Medium', 3],
      ['Large', 5],
    ])
  })
})
