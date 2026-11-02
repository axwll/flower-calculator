import { describe, expect, it } from 'vitest'

import { allocate } from './allocate'
import {
  buildPurchase,
  designChange,
  frozenOffer,
  priceChanges,
  purchaseChanges,
  refreshViewed,
} from './purchase'
import type { EventPlan, Flower, FrozenPrice, PriceReport } from './types'
import { NOW, daysAgo, design, flower, named, plan, report } from './testkit/builders'

function run(eventPlan: EventPlan, flowers: Flower[], prices: PriceReport[]) {
  return allocate({ plan: eventPlan, flowers, designs: [], prices, now: NOW })
}

function frozen(flowerId: string, overrides: Partial<FrozenPrice> = {}): FrozenPrice {
  return {
    flowerId,
    supplierId: 's',
    reportId: `${flowerId}-report`,
    pricePence: 1000,
    bunchSize: 10,
    reportedAt: daysAgo(3),
    ...overrides,
  }
}

function only(result: ReturnType<typeof run>, flowerId: string) {
  const found = result.flowers.find((item) => item.flowerId === flowerId)
  if (!found) throw new Error(`No result for ${flowerId}`)
  return found
}

function purchased(eventPlan: EventPlan, flowers: Flower[], prices: PriceReport[]) {
  return buildPurchase(eventPlan, run(eventPlan, flowers, prices), NOW)
}

describe('frozen prices in allocate', () => {
  const eventPlan = (flowerIds: FrozenPrice[] = [frozen('x')]) =>
    plan([design('a', 1, [named('x', 12)])], {}, { frozenPrices: flowerIds })

  it('uses a frozen price over a cheaper live one', () => {
    const result = run(eventPlan(), [flower('x')], [report('x', 'cheap', 1, 10)])

    expect(only(result, 'x')).toMatchObject({
      bunches: 2,
      costPence: 2000,
      needsData: null,
      offer: {
        supplierId: 's',
        pricePence: 1000,
        bunchSize: 10,
        reportId: 'x-report',
        frozen: true,
      },
    })
  })

  it('needs no live price at all', () => {
    expect(only(run(eventPlan(), [flower('x')], []), 'x').costPence).toBe(2000)
  })

  it('never flags a frozen price as stale', () => {
    const old = eventPlan([frozen('x', { reportedAt: daysAgo(400) })])
    const result = run(old, [flower('x')], [])

    expect(result.warnings).toEqual([])
    expect(only(result, 'x').offer?.freshness).toBe('fresh')
  })

  it('ignores a supplier override and stale alternatives', () => {
    const chosen = plan(
      [design('a', 1, [named('x', 12)])],
      {},
      { frozenPrices: [frozen('x')], supplierChoice: { x: 'other' } },
    )
    const result = run(
      chosen,
      [flower('x')],
      [report('x', 'other', 1, 10, { reportedAt: daysAgo(90) })],
    )

    expect(only(result, 'x').offer?.supplierId).toBe('s')
    expect(only(result, 'x').staleAlternatives).toEqual([])
  })

  it('leaves other flowers on live prices', () => {
    const both = plan(
      [design('a', 1, [named('x', 1), named('y', 1)])],
      {},
      { frozenPrices: [frozen('x')] },
    )
    const result = run(both, [flower('x'), flower('y')], [report('y', 'live', 300, 10)])

    expect(only(result, 'y').offer).toMatchObject({ supplierId: 'live', pricePence: 300 })
    expect(only(result, 'y').offer?.frozen).toBeUndefined()
  })

  it('leaves a foraged flower free', () => {
    const wild = plan([design('a', 1, [named('fern', 3)])], {}, { frozenPrices: [frozen('fern')] })

    expect(only(run(wild, [flower('fern', 'foraged')], []), 'fern').offer).toBeNull()
  })

  it('reports an event with no frozen prices as before', () => {
    const live = plan([design('a', 1, [named('x', 12)])])
    const empty = plan([design('a', 1, [named('x', 12)])], {}, { frozenPrices: [] })
    const prices = [report('x', 's', 1000, 10)]

    expect(run(empty, [flower('x')], prices)).toEqual(run(live, [flower('x')], prices))
  })
})

describe('frozenOffer', () => {
  it('keeps the frozen details and works out the age', () => {
    expect(frozenOffer(frozen('x', { reportedAt: daysAgo(2) }), NOW)).toEqual({
      supplierId: 's',
      reportId: 'x-report',
      pricePence: 1000,
      bunchSize: 10,
      reportedAt: daysAgo(2),
      ageDays: 2,
      freshness: 'fresh',
      frozen: true,
    })
  })
})

describe('buildPurchase', () => {
  const flowers = [flower('x'), flower('nothing'), flower('fern', 'foraged')]
  const eventPlan = () =>
    plan([design('a', 2, [named('x', 6), named('nothing', 1), named('fern', 1)])], {
      focal: ['x'],
    })
  const prices = [report('x', 's', 1000, 10, { reportedAt: daysAgo(4) })]

  it('records the moment, recipes, palette, settings and allocation', () => {
    const source = eventPlan()
    const allocation = run(source, flowers, prices)
    const snapshot = buildPurchase(source, allocation, NOW)

    expect(snapshot).toMatchObject({
      purchasedAt: NOW,
      designs: source.designs,
      palette: source.palette,
      settings: source.settings,
    })
    expect(snapshot.allocation).toEqual(allocation)
  })

  it('resolves each price, with its report', () => {
    const report1 = prices[0]

    expect(purchased(eventPlan(), flowers, prices).prices).toEqual([
      {
        flowerId: 'x',
        supplierId: 's',
        reportId: report1?.id,
        pricePence: 1000,
        bunchSize: 10,
        reportedAt: daysAgo(4),
      },
    ])
  })

  it('leaves out flowers with no stems', () => {
    const none = plan([design('a', 0, [named('x', 6)])])

    expect(purchased(none, flowers, prices).prices).toEqual([])
  })

  it('shares nothing with the event', () => {
    const source = eventPlan()
    const snapshot = purchased(source, flowers, prices)
    const line = source.designs[0]?.recipe.lines[0]
    if (line) line.stemsPerUnit = 99
    source.palette.focal.push('y')

    expect(snapshot.designs[0]?.recipe.lines[0]?.stemsPerUnit).toBe(6)
    expect(snapshot.palette.focal).toEqual(['x'])
  })
})

describe('purchaseChanges', () => {
  const flowers = [flower('x'), flower('y'), flower('stem', 'stem'), flower('fern', 'foraged')]
  const prices = [
    report('x', 's', 1000, 10),
    report('y', 's', 500, 10),
    report('stem', 's', 200, 1),
  ]
  const lines = (...items: Parameters<typeof named>[]) =>
    plan([
      design(
        'a',
        1,
        items.map((item) => named(...item)),
      ),
    ])
  const changes = (before: EventPlan, after: EventPlan) => {
    const snapshot = purchased(before, flowers, prices)
    const edited = { ...after, frozenPrices: snapshot.prices }
    return purchaseChanges(snapshot, run(edited, flowers, prices))
  }

  it('finds nothing when the event is unchanged', () => {
    expect(changes(lines(['x', 5]), lines(['x', 5]))).toEqual([])
  })

  it('ignores extra stems that the bought bunches cover', () => {
    expect(changes(lines(['x', 5]), lines(['x', 9]))).toEqual([])
  })

  it('flags a flower that was not purchased, at its live price', () => {
    expect(changes(lines(['x', 5]), lines(['x', 5], ['y', 12]))).toEqual([
      { flowerId: 'y', kind: 'added', soldAs: 'bunch', before: 0, after: 2, addedCostPence: 1000 },
    ])
  })

  it('flags extra bunches of a purchased flower, at its frozen price', () => {
    expect(changes(lines(['x', 5]), lines(['x', 25]))).toEqual([
      { flowerId: 'x', kind: 'more', soldAs: 'bunch', before: 1, after: 3, addedCostPence: 2000 },
    ])
  })

  it('counts stem-sold flowers in stems', () => {
    expect(changes(lines(['stem', 3]), lines(['stem', 5]))).toEqual([
      { flowerId: 'stem', kind: 'more', soldAs: 'stem', before: 3, after: 5, addedCostPence: 400 },
    ])
  })

  it('flags fewer bunches without adding any cost', () => {
    expect(changes(lines(['x', 25]), lines(['x', 5]))).toEqual([
      { flowerId: 'x', kind: 'fewer', soldAs: 'bunch', before: 3, after: 1, addedCostPence: 0 },
    ])
  })

  it('flags a purchased flower that has gone', () => {
    expect(changes(lines(['x', 5], ['y', 5]), lines(['x', 5]))).toEqual([
      { flowerId: 'y', kind: 'fewer', soldAs: 'bunch', before: 1, after: 0, addedCostPence: 0 },
    ])
  })

  it('counts more foraged stems at no cost', () => {
    expect(changes(lines(['fern', 2]), lines(['fern', 5]))).toEqual([
      { flowerId: 'fern', kind: 'more', soldAs: 'foraged', before: 2, after: 5, addedCostPence: 0 },
    ])
  })

  it('treats a flower with no price at purchase as added once it has one', () => {
    const before = lines(['z', 5])
    const zed = flower('z')
    const snapshot = purchased(before, [zed], [])
    const after = run(before, [zed], [report('z', 's', 700, 10)])

    expect(purchaseChanges(snapshot, after)).toEqual([
      { flowerId: 'z', kind: 'added', soldAs: 'bunch', before: 0, after: 1, addedCostPence: 700 },
    ])
  })
})

describe('designChange', () => {
  const eventPlan = (quantity: number) => plan([design('a', quantity, [named('x', 5)])])
  const snapshot = (quantity: number) => purchased(eventPlan(quantity), [flower('x')], [])
  const entry = (eventDesign: EventPlan) => {
    const found = eventDesign.designs[0]
    if (!found) throw new Error('No design')
    return found
  }

  it('finds nothing when the design matches', () => {
    expect(designChange(snapshot(2), entry(eventPlan(2)))).toBeNull()
  })

  it('finds nothing for a design with no placements either side', () => {
    expect(designChange(snapshot(0), entry(eventPlan(0)))).toBeNull()
  })

  it('calls a design with new placements added', () => {
    expect(designChange(snapshot(0), entry(eventPlan(2)))).toBe('added')
  })

  it('calls a design missing from the purchase added', () => {
    const other = plan([design('b', 1, [named('x', 5)])])

    expect(designChange(snapshot(2), entry(other))).toBe('added')
  })

  it('calls a new quantity changed', () => {
    expect(designChange(snapshot(2), entry(eventPlan(3)))).toBe('changed')
  })

  it('calls a removed design changed', () => {
    expect(designChange(snapshot(2), entry(eventPlan(0)))).toBe('changed')
  })

  it('calls an edited recipe changed', () => {
    const edited = plan([design('a', 2, [named('x', 6)])])

    expect(designChange(snapshot(2), entry(edited))).toBe('changed')
  })

  it('calls a new leave-out list changed', () => {
    const edited = entry(eventPlan(2))

    expect(designChange(snapshot(2), { ...edited, excludedFlowerIds: ['y'] })).toBe('changed')
  })
})

describe('price changes', () => {
  const flowers = [flower('x')]
  const eventPlan = (stems = 5, extra: Partial<EventPlan> = {}) =>
    plan([design('a', 1, [named('x', stems)])], {}, extra)
  const viewedAt = (prices: PriceReport[], stems = 5) =>
    refreshViewed({}, run(eventPlan(stems), flowers, prices))

  it('finds nothing on a first view', () => {
    const allocation = run(eventPlan(), flowers, [report('x', 's', 1000, 10)])

    expect(priceChanges({}, allocation)).toEqual([])
  })

  it('finds nothing when the price is the same under a new report', () => {
    const viewed = viewedAt([report('x', 's', 1000, 10)])
    const newer = { ...report('x', 's', 1000, 10), id: 'newer' }

    expect(priceChanges(viewed, run(eventPlan(), flowers, [newer]))).toEqual([])
  })

  it('reports a new price from the same supplier', () => {
    const viewed = viewedAt([report('x', 's', 1000, 10)])

    expect(priceChanges(viewed, run(eventPlan(), flowers, [report('x', 's', 1200, 10)]))).toEqual([
      {
        flowerId: 'x',
        from: { supplierId: 's', pricePence: 1000, bunchSize: 10 },
        to: { supplierId: 's', pricePence: 1200, bunchSize: 10 },
      },
    ])
  })

  it('reports a new bunch size', () => {
    const viewed = viewedAt([report('x', 's', 1000, 10)])
    const changed = priceChanges(viewed, run(eventPlan(), flowers, [report('x', 's', 1000, 20)]))

    expect(changed[0]?.to.bunchSize).toBe(20)
  })

  it('reports a move to a new supplier', () => {
    const viewed = viewedAt([report('x', 's', 1000, 10)])
    const moved = run(eventPlan(), flowers, [report('x', 'other', 900, 10)])

    expect(priceChanges(viewed, moved)[0]?.to.supplierId).toBe('other')
  })

  it('ignores a supplier move caused by changing stems', () => {
    const viewed = viewedAt([report('x', 's', 1000, 10)])
    const moved = run(eventPlan(9), flowers, [report('x', 'other', 900, 10)])

    expect(priceChanges(viewed, moved)).toEqual([])
  })

  it('ignores frozen prices', () => {
    const viewed = viewedAt([report('x', 's', 1000, 10)])
    const held = eventPlan(5, { frozenPrices: [frozen('x', { pricePence: 1500 })] })

    expect(priceChanges(viewed, run(held, flowers, []))).toEqual([])
  })

  it('ignores a flower that has lost its price', () => {
    const viewed = viewedAt([report('x', 's', 1000, 10)])

    expect(priceChanges(viewed, run(eventPlan(), flowers, []))).toEqual([])
  })
})

describe('refreshViewed', () => {
  const flowers = [flower('x'), flower('y')]
  const eventPlan = (xStems = 5) => plan([design('a', 1, [named('x', xStems), named('y', 5)])])

  it('records each priced flower in use', () => {
    const allocation = run(eventPlan(), flowers, [report('x', 's', 1000, 10)])

    expect(refreshViewed({}, allocation)).toEqual({
      x: { supplierId: 's', pricePence: 1000, bunchSize: 10, stems: 5 },
    })
  })

  it('leaves frozen prices out', () => {
    const held = plan([design('a', 1, [named('x', 5)])], {}, { frozenPrices: [frozen('x')] })

    expect(refreshViewed({}, run(held, flowers, []))).toEqual({})
  })

  it('keeps a changed price until it is acknowledged', () => {
    const viewed = refreshViewed({}, run(eventPlan(), flowers, [report('x', 's', 1000, 10)]))
    const later = run(eventPlan(), flowers, [report('x', 's', 1200, 10)])

    expect(refreshViewed(viewed, later).x?.pricePence).toBe(1000)
  })

  it('follows changed stems when the price holds', () => {
    const viewed = refreshViewed({}, run(eventPlan(), flowers, [report('x', 's', 1000, 10)]))
    const later = run(eventPlan(7), flowers, [report('x', 's', 1000, 10)])

    expect(refreshViewed(viewed, later).x?.stems).toBe(7)
  })

  it('keeps entries for flowers no longer in use', () => {
    const viewed = { z: { supplierId: 's', pricePence: 1, bunchSize: 1, stems: 1 } }
    const later = run(eventPlan(), flowers, [])

    expect(refreshViewed(viewed, later)).toEqual(viewed)
  })
})
