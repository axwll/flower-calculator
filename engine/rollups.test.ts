import { describe, expect, it } from 'vitest'

import { allocate } from './allocate'
import type { EventPlan } from './types'
import { NOW, design, flower, named, plan, report } from './testkit/builders'

const flowers = [
  flower('x'),
  flower('y'),
  flower('z', 'stem'),
  flower('fern', 'foraged'),
  flower('needs'),
]
const prices = [report('x', 's1', 1000, 10), report('y', 's2', 500, 10), report('z', 's1', 100, 1)]
const designs = [
  { id: 'main', name: 'Main', group: 'Reception', optional: false },
  { id: 'side', name: 'Side', group: 'Reception', optional: false },
  { id: 'vases', name: 'Table vases', group: 'Reception', optional: false, isLeftoverPool: true },
]

function run(eventPlan: EventPlan) {
  return allocate({ plan: eventPlan, flowers, designs, prices, now: NOW })
}

const fullPlan = plan([
  design('main', 1, [named('x', 12), named('y', 5), named('z', 3)]),
  design('side', 1, [named('fern', 4), named('needs', 2)]),
])

describe('order list', () => {
  it('groups flowers by supplier with subtotals', () => {
    const { orderList } = run(fullPlan)

    expect(
      orderList.map((order) => [
        order.supplierId,
        order.flowers.map((item) => item.flowerId),
        order.subtotalPence,
      ]),
    ).toEqual([
      ['s1', ['x', 'z'], 2300],
      ['s2', ['y'], 500],
    ])
  })

  it('leaves out flowers with no stems', () => {
    const { orderList } = run(
      plan([design('main', 1, [{ kind: 'role', role: 'focal', stemsPerUnit: 1 }])], {
        focal: ['x', 'y'],
      }),
    )

    expect(orderList.flatMap((order) => order.flowers.map((item) => item.flowerId))).toEqual(['y'])
  })
})

describe('gather list', () => {
  it('lists foraged flowers', () => {
    expect(run(fullPlan).gatherList).toEqual([{ flowerId: 'fern', stems: 4 }])
  })
})

describe('totals', () => {
  it('adds up stems, spare stems and cost', () => {
    expect(run(fullPlan).totals).toEqual({
      stems: 26,
      unassignedStems: 0,
      spareStems: 13,
      spareCostPence: 1050,
      costPence: 2800,
      needsDataFlowers: 1,
    })
  })

  it('counts unassigned stems separately', () => {
    const { totals } = run(
      plan([design('main', 2, [{ kind: 'role', role: 'focal', stemsPerUnit: 3 }])]),
    )

    expect(totals).toMatchObject({ stems: 0, unassignedStems: 6 })
  })
})

describe('cost per design', () => {
  function costs(eventPlan: EventPlan) {
    return run(eventPlan).designs.map((item) => [item.designId, item.costPence])
  }

  it('spreads the cost of spare stems across designs', () => {
    expect(
      costs(plan([design('main', 1, [named('x', 6)]), design('side', 1, [named('x', 3)])])),
    ).toEqual([
      ['main', 667],
      ['side', 333],
    ])
  })

  it('sums to the grand total when pence cannot divide evenly', () => {
    expect(
      costs(
        plan([
          design('main', 1, [named('x', 1)]),
          design('side', 1, [named('x', 1)]),
          design('main', 1, [named('x', 1)]),
        ]),
      ),
    ).toEqual([
      ['main', 334],
      ['side', 333],
      ['main', 333],
    ])
  })

  it('adds up across flowers in a design', () => {
    expect(costs(fullPlan)).toEqual([
      ['main', 2800],
      ['side', 0],
    ])
  })

  it('leaves out the leftover pool and disabled designs', () => {
    expect(
      costs(
        plan([
          design('main', 1, [named('x', 9)]),
          design('side', 1, [named('x', 1)], { enabled: false }),
          design('vases', 11, []),
        ]),
      ),
    ).toEqual([['main', 1000]])
  })
})

describe('budget check', () => {
  it('reports nothing when no target is set', () => {
    expect(run(fullPlan).budget).toBeNull()
  })

  it('reports nothing at or under the target', () => {
    expect(run({ ...fullPlan, targetBudgetPence: 2800 }).budget).toBeNull()
    expect(run({ ...fullPlan, targetBudgetPence: 9000 }).budget).toBeNull()
  })

  it('reports the top cost drivers when over the target', () => {
    expect(run({ ...fullPlan, targetBudgetPence: 2000 }).budget).toEqual({
      targetPence: 2000,
      overByPence: 800,
      topFlowers: [
        { flowerId: 'x', costPence: 2000 },
        { flowerId: 'y', costPence: 500 },
        { flowerId: 'z', costPence: 300 },
      ],
      topDesigns: [
        { designIndex: 0, designId: 'main', costPence: 2800 },
        { designIndex: 1, designId: 'side', costPence: 0 },
      ],
    })
  })

  it('keeps only the top three flowers', () => {
    const many = [flower('a'), flower('b'), flower('c'), flower('d')]
    const { budget } = allocate({
      plan: plan(
        [
          design(
            'main',
            1,
            ['a', 'b', 'c', 'd'].map((id) => named(id, 1)),
          ),
        ],
        {},
        {
          targetBudgetPence: 1,
        },
      ),
      flowers: many,
      designs,
      prices: ['a', 'b', 'c', 'd'].map((id) => report(id, 's', 100, 10)),
      now: NOW,
    })

    expect(budget?.topFlowers.map((item) => item.flowerId)).toEqual(['a', 'b', 'c'])
  })
})
