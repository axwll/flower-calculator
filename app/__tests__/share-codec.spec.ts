import { describe, expect, it } from 'vitest'

import type { EventPlan } from '@engine'

import { MAX_SHARE_CHARS, decodePlan, encodePlan, gzipText } from '../share/codec'
import { useEventStore } from '../stores/event'
import { mountEvent, setDesign } from './helpers'

function plan(overrides: Partial<EventPlan> = {}): EventPlan {
  return {
    schemaVersion: 1,
    id: 'event-1',
    name: 'June wedding — ünïcödé 🌸',
    designs: [],
    palette: { focal: [], secondary: [], filler: [], foliage: [], accent: [] },
    supplierChoice: {},
    settings: { thinBunchPercent: 15, priceAmberDays: 14, priceRedDays: 30, bigChangePercent: 50 },
    ...overrides,
  }
}

async function largePurchasedEvent(store: ReturnType<typeof useEventStore>) {
  store.current?.designs.forEach((design) => {
    setDesign(store, design.designId, 40)
  })
  store.togglePalette('focal', 'focus-rose')
  store.togglePalette('secondary', 'wax-flower')
  store.markPurchased()
  return JSON.parse(JSON.stringify(store.current)) as EventPlan
}

describe('plan codec', () => {
  it('round trips an event, whatever its text', async () => {
    const event = plan()

    expect(await decodePlan(await encodePlan(event))).toEqual(event)
  })

  it('only uses characters that are safe in a link and a cell', async () => {
    expect(await encodePlan(plan())).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('leaves out which prices the sharer has seen', async () => {
    const viewed = { x: { supplierId: 's', pricePence: 1, bunchSize: 1, stems: 1 } }
    const decoded = (await decodePlan(
      await encodePlan(plan({ viewedPrices: viewed })),
    )) as EventPlan

    expect(decoded.viewedPrices).toBeUndefined()
  })

  it('fits a large purchased event in a cell, with its prices', async () => {
    const { store } = await mountEvent('review')
    const event = await largePurchasedEvent(store)
    const text = await encodePlan(event)

    expect(text.length).toBeLessThan(MAX_SHARE_CHARS)
    expect((await decodePlan(text)) as EventPlan).toMatchObject({
      purchase: event.purchase,
      frozenPrices: event.frozenPrices,
    })
  })

  it.each([
    ['empty text', ''],
    ['text that was never compressed', 'aGVsbG8'],
    ['a character that is not in the alphabet', 'abc$'],
  ])('refuses %s', async (_label, text) => {
    await expect(decodePlan(text)).rejects.toThrow('hold a plan')
  })

  it('refuses a cut-off plan', async () => {
    const text = await encodePlan(plan())

    await expect(decodePlan(text.slice(0, text.length / 2))).rejects.toThrow('hold a plan')
  })

  it('refuses compressed text that is not JSON', async () => {
    await expect(decodePlan(await gzipText('not json'))).rejects.toThrow('hold a plan')
  })

  it('stops reading a plan that unpacks to something huge', async () => {
    await expect(decodePlan(await gzipText(' '.repeat(3_000_000)))).rejects.toThrow('hold a plan')
  })
})
