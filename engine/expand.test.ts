import { describe, expect, it } from 'vitest'

import { expandPlan } from './expand'
import { design, named, plan, role } from './testkit/builders'

describe('expandPlan', () => {
  it('gives a named line stems per unit times quantity', () => {
    const { lines } = expandPlan(plan([design('bouquet', 7, [named('rose', 4)])]))

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      role: null,
      total: 28,
      eligibleFlowerIds: ['rose'],
      equalShare: 28,
      floating: 0,
      unassigned: 0,
    })
  })

  it('splits at the line total, not per placement', () => {
    const { lines } = expandPlan(
      plan([design('bouquet', 7, [role('secondary', 5)])], { secondary: ['a', 'b', 'c'] }),
    )

    expect(lines[0]).toMatchObject({ total: 35, equalShare: 11, floating: 2, unassigned: 0 })
  })

  it('leaves nothing floating when a line divides evenly', () => {
    const { lines } = expandPlan(
      plan([design('table', 1, [role('focal', 9)])], { focal: ['a', 'b', 'c'] }),
    )

    expect(lines[0]).toMatchObject({ equalShare: 3, floating: 0 })
  })

  it('makes every stem floating when the total is below the flower count', () => {
    const { lines } = expandPlan(
      plan([design('table', 1, [role('focal', 2)])], { focal: ['a', 'b', 'c'] }),
    )

    expect(lines[0]).toMatchObject({ equalShare: 0, floating: 2 })
  })

  it('removes excluded flowers before splitting', () => {
    const { lines } = expandPlan(
      plan([design('table', 1, [role('focal', 9)], { excludedFlowerIds: ['b'] })], {
        focal: ['a', 'b', 'c'],
      }),
    )

    expect(lines[0]).toMatchObject({
      eligibleFlowerIds: ['a', 'c'],
      equalShare: 4,
      floating: 1,
    })
  })

  it('does not apply exclusions to named lines', () => {
    const { lines } = expandPlan(
      plan([design('table', 1, [named('a', 3)], { excludedFlowerIds: ['a'] })]),
    )

    expect(lines[0]).toMatchObject({ eligibleFlowerIds: ['a'], equalShare: 3 })
  })

  it('leaves stems unassigned and warns when a role has no eligible flowers', () => {
    const { lines, warnings } = expandPlan(plan([design('table', 2, [role('focal', 7)])]))

    expect(lines[0]).toMatchObject({
      eligibleFlowerIds: [],
      equalShare: 0,
      floating: 0,
      unassigned: 14,
    })
    expect(warnings).toEqual([
      { code: 'no-flowers-for-role', designIndex: 0, designId: 'table', role: 'focal', stems: 14 },
    ])
  })

  it('warns when exclusions remove every flower for a role', () => {
    const { lines, warnings } = expandPlan(
      plan([design('table', 1, [role('focal', 4)], { excludedFlowerIds: ['a'] })], {
        focal: ['a'],
      }),
    )

    expect(lines[0]?.unassigned).toBe(4)
    expect(warnings).toHaveLength(1)
  })

  it('skips disabled designs but keeps indexes pointing at the plan', () => {
    const { lines } = expandPlan(
      plan([
        design('off', 3, [named('a', 1)], { enabled: false }),
        design('on', 1, [named('b', 1)]),
      ]),
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ designIndex: 1, designId: 'on' })
  })

  it('gives no stems and no warning at quantity 0', () => {
    const { lines, warnings } = expandPlan(plan([design('table', 0, [role('focal', 7)])]))

    expect(lines[0]).toMatchObject({ total: 0, unassigned: 0 })
    expect(warnings).toEqual([])
  })

  it('treats two lines for the same role separately', () => {
    const { lines } = expandPlan(
      plan([design('table', 1, [role('focal', 4), role('focal', 5)])], { focal: ['a', 'b'] }),
    )

    expect(lines.map((line) => [line.lineIndex, line.equalShare, line.floating])).toEqual([
      [0, 2, 0],
      [1, 2, 1],
    ])
  })

  it('sorts eligible flowers and ignores a flower ticked twice', () => {
    const { lines } = expandPlan(
      plan([design('table', 1, [role('focal', 6)])], { focal: ['c', 'a', 'c', 'b'] }),
    )

    expect(lines[0]).toMatchObject({ eligibleFlowerIds: ['a', 'b', 'c'], equalShare: 2 })
  })

  it.each([
    ['a negative quantity', -1, 1],
    ['a fractional quantity', 1.5, 1],
    ['a negative stem count', 1, -1],
    ['a fractional stem count', 1, 0.5],
  ])('throws on %s', (_label, quantity, stems) => {
    expect(() => expandPlan(plan([design('table', quantity, [named('a', stems)])]))).toThrow(
      RangeError,
    )
  })
})
