import { describe, expect, it } from 'vitest'

import { allocate } from './allocate'
import { NOW, design, flower, named, plan, report } from './testkit/builders'

const designs = [
  { id: 'main', name: 'Main', group: 'Reception', optional: false },
  { id: 'vases', name: 'Table vases', group: 'Reception', optional: true, isLeftoverPool: true },
]
const prices = [report('x', 's', 1000, 10), report('y', 's', 1000, 10)]
const flowers = [flower('x'), flower('y')]

function pools(...planDesigns: Parameters<typeof plan>[0]) {
  return allocate({ plan: plan(planDesigns), flowers, designs, prices, now: NOW }).leftoverPools
}

describe('leftover pool', () => {
  it('reports spare stems per flower and per placement', () => {
    expect(
      pools(design('main', 1, [named('x', 3), named('y', 8)]), design('vases', 4, [])),
    ).toEqual([
      {
        designIndex: 1,
        designId: 'vases',
        quantity: 4,
        totalSpare: 9,
        flowers: [
          { flowerId: 'x', spare: 7, perPlacement: 1.75 },
          { flowerId: 'y', spare: 2, perPlacement: 0.5 },
        ],
      },
    ])
  })

  it('leaves out flowers with no spare stems', () => {
    const [pool] = pools(design('main', 1, [named('x', 10)]), design('vases', 2, []))

    expect(pool?.flowers).toEqual([])
    expect(pool?.totalSpare).toBe(0)
  })

  it('is absent when no design is a pool', () => {
    expect(pools(design('main', 1, [named('x', 3)]))).toEqual([])
  })

  it('is absent when the pool is switched off', () => {
    expect(
      pools(design('main', 1, [named('x', 3)]), design('vases', 4, [], { enabled: false })),
    ).toEqual([])
  })

  it('does not divide by zero at quantity 0', () => {
    expect(pools(design('main', 1, [named('x', 3)]), design('vases', 0, []))).toEqual([])
  })
})
