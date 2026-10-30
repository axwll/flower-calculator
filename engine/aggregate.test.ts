import { describe, expect, it } from 'vitest'

import { aggregateStems } from './aggregate'
import { expandPlan } from './expand'
import { design, named, plan, role } from './testkit/builders'

function aggregate(...args: Parameters<typeof plan>) {
  return [...aggregateStems(expandPlan(plan(...args)).lines)]
}

describe('aggregateStems', () => {
  it('sums a flower across designs', () => {
    expect(
      aggregate([design('a', 2, [named('rose', 3)]), design('b', 1, [named('rose', 4)])]),
    ).toEqual([['rose', 10]])
  })

  it('sums a flower across roles and named lines', () => {
    expect(
      aggregate([design('a', 1, [named('rose', 5), role('focal', 4), role('filler', 6)])], {
        focal: ['rose', 'tulip'],
        filler: ['rose', 'tulip', 'fern'],
      }),
    ).toEqual([
      ['fern', 2],
      ['rose', 9],
      ['tulip', 4],
    ])
  })

  it('leaves floating stems out of the totals', () => {
    expect(aggregate([design('a', 1, [role('focal', 7)])], { focal: ['x', 'y'] })).toEqual([
      ['x', 3],
      ['y', 3],
    ])
  })

  it('keeps a flower with no equal share so it can take floating stems', () => {
    expect(aggregate([design('a', 1, [role('focal', 1)])], { focal: ['x', 'y'] })).toEqual([
      ['x', 0],
      ['y', 0],
    ])
  })

  it('orders flowers by id whatever order the plan uses', () => {
    expect(
      aggregate([design('a', 1, [named('zinnia', 1), named('aster', 1), named('mum', 1)])]).map(
        ([id]) => id,
      ),
    ).toEqual(['aster', 'mum', 'zinnia'])
  })

  it('returns nothing for an empty plan', () => {
    expect(aggregate([])).toEqual([])
  })
})
