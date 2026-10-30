import { describe, expect, it } from 'vitest'

import { allocate } from './allocate'
import { dealLine, groupRanges } from './placements'
import { NOW, design, flower, named, plan, report, role } from './testkit/builders'

function deal(stems: Record<string, number>, quantity: number) {
  return dealLine(new Map(Object.entries(stems)), quantity)
}

describe('groupRanges', () => {
  it('groups neighbouring placements with the same count, numbered from 1', () => {
    expect(groupRanges([2, 2, 2, 1, 1, 1, 1])).toEqual([
      { from: 1, to: 3, stems: 2 },
      { from: 4, to: 7, stems: 1 },
    ])
  })

  it('keeps separate ranges when equal counts are not neighbours', () => {
    expect(groupRanges([1, 2, 2, 1])).toEqual([
      { from: 1, to: 1, stems: 1 },
      { from: 2, to: 3, stems: 2 },
      { from: 4, to: 4, stems: 1 },
    ])
  })

  it('gives one range for a single placement', () => {
    expect(groupRanges([5])).toEqual([{ from: 1, to: 1, stems: 5 }])
  })

  it('gives no ranges for no placements', () => {
    expect(groupRanges([])).toEqual([])
  })
})

describe('dealLine', () => {
  it('spreads one flower as evenly as possible', () => {
    expect(deal({ scabious: 10 }, 7)).toEqual([
      {
        flowerId: 'scabious',
        stems: 10,
        perPlacement: [2, 2, 2, 1, 1, 1, 1],
        ranges: [
          { from: 1, to: 3, stems: 2 },
          { from: 4, to: 7, stems: 1 },
        ],
      },
    ])
  })

  it('carries on dealing from where the last flower stopped', () => {
    const [first, second] = deal({ a: 8, b: 6 }, 7)

    expect(first?.perPlacement).toEqual([2, 1, 1, 1, 1, 1, 1])
    expect(second?.perPlacement).toEqual([0, 1, 1, 1, 1, 1, 1])
  })

  it('wraps round the placements', () => {
    const dealt = deal({ a: 5, b: 6, c: 1 }, 4)

    expect(dealt.map((item) => item.perPlacement)).toEqual([
      [2, 1, 1, 1],
      [1, 2, 2, 1],
      [0, 0, 0, 1],
    ])
  })

  it('gives each placement the same total', () => {
    const dealt = deal({ a: 11, b: 12, c: 12 }, 7)
    const totals = [0, 1, 2, 3, 4, 5, 6].map((placement) =>
      dealt.reduce((sum, item) => sum + (item.perPlacement[placement] ?? 0), 0),
    )

    expect(totals).toEqual([5, 5, 5, 5, 5, 5, 5])
  })

  it('handles a flower with fewer stems than placements', () => {
    expect(deal({ a: 2 }, 5)[0]?.perPlacement).toEqual([1, 1, 0, 0, 0])
  })

  it('gives quantity 1 everything', () => {
    expect(deal({ a: 3, b: 4 }, 1).map((item) => item.perPlacement)).toEqual([[3], [4]])
  })

  it('leaves out flowers with no stems on this line', () => {
    expect(deal({ a: 0, b: 2 }, 2).map((item) => item.flowerId)).toEqual(['b'])
  })

  it('deals nothing at quantity 0', () => {
    expect(deal({ a: 0 }, 0)).toEqual([])
  })
})

describe('allocate: design lines', () => {
  const flowers = [flower('x'), flower('y'), flower('z')]
  const prices = ['x', 'y', 'z'].map((id) => report(id, 's', 1000, 10))

  function run(...args: Parameters<typeof plan>) {
    return allocate({ plan: plan(...args), flowers, designs: [], prices, now: NOW }).designs
  }

  it('deals floating stems along with the equal share', () => {
    const [bouquets] = run([design('bouquets', 7, [role('secondary', 5)])], {
      secondary: ['x', 'y', 'z'],
    })
    const line = bouquets?.lines[0]

    expect(line).toMatchObject({ role: 'secondary', stemsPerUnit: 5, unassignedStems: 0 })
    expect(line?.flowers.reduce((sum, item) => sum + item.stems, 0)).toBe(35)
  })

  it('shows a named line with its role empty', () => {
    const [table] = run([design('table', 2, [named('x', 3)])])

    expect(table?.lines).toEqual([
      {
        role: null,
        stemsPerUnit: 3,
        unassignedStems: 0,
        flowers: [
          {
            flowerId: 'x',
            stems: 6,
            perPlacement: [3, 3],
            ranges: [{ from: 1, to: 2, stems: 3 }],
          },
        ],
      },
    ])
  })

  it('reports unassigned stems on the line', () => {
    const [table] = run([design('table', 2, [role('focal', 3)])])

    expect(table?.lines[0]).toMatchObject({ unassignedStems: 6, flowers: [] })
  })
})
