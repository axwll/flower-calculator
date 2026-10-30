import { describe, expect, it } from 'vitest'

import { allocate } from './allocate'
import type { AllocationInput } from './allocate'
import type { EventPlan, Flower, PriceReport } from './types'
import { NOW, daysAgo, design, flower, named, plan, report, role } from './testkit/builders'

function run(
  eventPlan: EventPlan,
  flowers: Flower[],
  prices: PriceReport[] = [],
  extra: Partial<AllocationInput> = {},
) {
  return allocate({ plan: eventPlan, flowers, designs: [], prices, now: NOW, ...extra })
}

function flowerResult(result: ReturnType<typeof run>, id: string) {
  const found = result.flowers.find((item) => item.flowerId === id)
  if (!found) throw new Error(`No result for ${id}`)
  return found
}

describe('allocate: flowers', () => {
  it('adds floating stems to the equal share', () => {
    const result = run(
      plan([design('a', 1, [role('focal', 7)])], { focal: ['x', 'y'] }),
      [flower('x'), flower('y')],
      [report('x', 's', 1000, 10), report('y', 's', 1000, 10)],
    )

    expect(result.flowers.map((item) => [item.flowerId, item.stems])).toEqual([
      ['x', 4],
      ['y', 3],
    ])
  })

  it('reports supplier, bunches, spare stems and cost', () => {
    const result = run(
      plan([design('a', 1, [named('x', 12)])]),
      [flower('x')],
      [report('x', 's', 1000, 10)],
    )

    expect(flowerResult(result, 'x')).toMatchObject({
      soldAs: 'bunch',
      stems: 12,
      bunches: 2,
      spare: 8,
      costPence: 2000,
      needsData: null,
      offer: { supplierId: 's', pricePence: 1000, bunchSize: 10 },
    })
  })

  it('uses the override from the plan', () => {
    const result = run(
      plan([design('a', 1, [named('x', 5)])], {}, { supplierChoice: { x: 'dear' } }),
      [flower('x')],
      [report('x', 'cheap', 100, 10), report('x', 'dear', 1000, 10)],
    )

    expect(flowerResult(result, 'x').offer?.supplierId).toBe('dear')
  })

  it('does not look up a supplier for a foraged flower', () => {
    const result = run(plan([design('a', 1, [named('fern', 5)])]), [flower('fern', 'foraged')])

    expect(flowerResult(result, 'fern')).toMatchObject({ offer: null, needsData: null })
    expect(result.warnings).toEqual([])
  })
})

describe('allocate: needs data', () => {
  it('counts stems, excludes cost and warns when there is no price', () => {
    const result = run(plan([design('a', 2, [named('x', 5)])]), [flower('x')])

    expect(flowerResult(result, 'x')).toMatchObject({
      stems: 10,
      costPence: 0,
      needsData: 'no-price',
    })
    expect(result.warnings).toEqual([
      { code: 'needs-data', flowerId: 'x', stems: 10, reason: 'no-price' },
    ])
  })

  it('treats a flower missing from the catalogue as needs data', () => {
    const result = run(plan([design('a', 1, [named('ghost', 3)])]), [])

    expect(flowerResult(result, 'ghost')).toMatchObject({ stems: 3, needsData: 'unknown-flower' })
  })

  it('does not warn about a ticked flower that ends up with no stems', () => {
    const result = run(
      plan([design('a', 1, [role('focal', 1)])], { focal: ['x', 'y'] }),
      [flower('x'), flower('y')],
      [report('x', 's', 1000, 10)],
    )

    expect(flowerResult(result, 'y').stems).toBe(0)
    expect(result.warnings.some((warning) => warning.code === 'needs-data')).toBe(false)
  })
})

describe('allocate: warnings', () => {
  it('passes on unassigned role stems', () => {
    const result = run(plan([design('a', 1, [role('focal', 4)])]), [])

    expect(result.warnings).toEqual([
      { code: 'no-flowers-for-role', designIndex: 0, designId: 'a', role: 'focal', stems: 4 },
    ])
  })

  it('flags a stale price when it is the only one', () => {
    const stale = report('x', 's', 1000, 10, { reportedAt: daysAgo(40) })
    const result = run(plan([design('a', 1, [named('x', 5)])]), [flower('x')], [stale])

    expect(result.warnings).toEqual([
      { code: 'stale-price', flowerId: 'x', supplierId: 's', reportId: stale.id, ageDays: 40 },
    ])
  })

  it('shows a cheaper stale price as an alternative', () => {
    const result = run(
      plan([design('a', 1, [named('x', 5)])]),
      [flower('x')],
      [report('x', 'old', 100, 10, { reportedAt: daysAgo(40) }), report('x', 'new', 1000, 10)],
    )

    expect(flowerResult(result, 'x').offer?.supplierId).toBe('new')
    expect(flowerResult(result, 'x').staleAlternatives.map((alt) => alt.supplierId)).toEqual([
      'old',
    ])
    expect(result.warnings).toEqual([])
  })

  it('warns about a thin last bunch', () => {
    const result = run(
      plan([design('a', 1, [named('x', 11)])]),
      [flower('x')],
      [report('x', 's', 1000, 10)],
    )

    expect(result.warnings).toEqual([
      { code: 'thin-bunch', flowerId: 'x', lastBunchStems: 1, bunchSize: 10 },
    ])
  })
})

describe('allocate: supplier re-check after floating stems', () => {
  const eventPlan = plan([design('a', 1, [named('x', 10), role('focal', 1)])], {
    focal: ['needs', 'x'],
  })
  const flowers = [flower('x'), flower('needs')]
  const prices = [report('x', 'small', 1000, 10), report('x', 'large', 1100, 20)]

  it('moves to the supplier that is now cheapest', () => {
    const result = run(eventPlan, flowers, prices)

    expect(flowerResult(result, 'x')).toMatchObject({
      stems: 11,
      bunches: 1,
      spare: 9,
      costPence: 1100,
      offer: { supplierId: 'large' },
    })
  })

  it('notes the change', () => {
    const result = run(eventPlan, flowers, prices)

    expect(result.warnings).toContainEqual({
      code: 'supplier-changed',
      flowerId: 'x',
      fromSupplierId: 'small',
      toSupplierId: 'large',
    })
  })

  it('leaves an override alone', () => {
    const result = run({ ...eventPlan, supplierChoice: { x: 'small' } }, flowers, prices)

    expect(flowerResult(result, 'x').offer?.supplierId).toBe('small')
    expect(result.warnings.some((warning) => warning.code === 'supplier-changed')).toBe(false)
  })

  it('stays quiet when the choice still holds', () => {
    const result = run(
      plan([design('a', 1, [named('x', 5)])]),
      [flower('x')],
      [report('x', 'a', 1000, 10), report('x', 'b', 2000, 10)],
    )

    expect(result.warnings).toEqual([])
  })
})

describe('allocate: purity', () => {
  it('gives the same result twice and leaves its input alone', () => {
    const eventPlan = plan([design('a', 7, [role('focal', 5)])], { focal: ['z', 'y', 'x'] })
    const flowers = [flower('x'), flower('y'), flower('z')]
    const before = JSON.stringify(eventPlan)

    expect(run(eventPlan, flowers)).toEqual(run(eventPlan, flowers))
    expect(JSON.stringify(eventPlan)).toBe(before)
  })
})
