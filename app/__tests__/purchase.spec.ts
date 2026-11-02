import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import type { EventPlan, PriceReport } from '@engine'

import { buildBackup, parseBackup } from '../storage/backup'
import { migrateEvent } from '../storage/migrations'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { mountApp, mountEvent, setDesign } from './helpers'

function livePrice(flowerId: string, pricePence: number, supplierId = 'wholesaler-a') {
  const report: PriceReport = {
    id: `later-${flowerId}-${pricePence}`,
    flowerId,
    supplierId,
    pricePence,
    stemsPerBunch: 48,
    reportedAt: new Date(Date.now() + 1000).toISOString(),
    reportedBy: 'Sam',
    status: 'active',
  }
  return report
}

async function planned(step: Parameters<typeof mountEvent>[0] = 'review') {
  const mounted = await mountEvent(step)
  setDesign(mounted.store, 'pedestal', 2)
  mounted.store.togglePalette('focal', 'focus-rose')
  await flushPromises()
  return mounted
}

function flowerResult(store: ReturnType<typeof useEventStore>, flowerId: string) {
  return store.allocation?.flowers.find((item) => item.flowerId === flowerId)
}

describe('markPurchased', () => {
  it('stores a snapshot and freezes the prices in use', async () => {
    const { store } = await planned()
    const price = flowerResult(store, 'focus-rose')?.offer?.pricePence

    expect(store.markPurchased()).toBe(true)
    expect(
      store.current?.purchase?.prices.find(({ flowerId }) => flowerId === 'focus-rose'),
    ).toMatchObject({ pricePence: price, flowerId: 'focus-rose' })
    expect(store.current?.purchase?.allocation.totals.costPence).toBeGreaterThan(0)
    expect(store.current?.frozenPrices).toEqual(store.current?.purchase?.prices)
  })

  it('only happens once', async () => {
    const { store } = await planned()
    store.markPurchased()
    const first = JSON.stringify(store.current?.purchase)
    setDesign(store, 'pedestal', 9)

    expect(store.markPurchased()).toBe(false)
    expect(JSON.stringify(store.current?.purchase)).toBe(first)
  })

  it('refuses an event with nothing to buy', async () => {
    const { store } = await mountEvent('review')

    expect(store.markPurchased()).toBe(false)
    expect(store.current?.purchase).toBeUndefined()
  })

  it('keeps the frozen price when live prices move', async () => {
    const { store } = await planned()
    store.markPurchased()
    const before = flowerResult(store, 'focus-rose')
    const catalogue = useCatalogueStore()
    catalogue.prices = [...catalogue.prices, livePrice('focus-rose', 1)]

    expect(flowerResult(store, 'focus-rose')?.costPence).toBe(before?.costPence)
    expect(flowerResult(store, 'focus-rose')?.offer?.frozen).toBe(true)
  })

  it('never lets later edits reach the snapshot', async () => {
    const { store } = await planned()
    store.markPurchased()
    const before = JSON.stringify(store.current?.purchase)

    setDesign(store, 'pedestal', 9)
    store.setLineStems(0, 0, 77)
    store.togglePalette('focal', 'hydrangea')
    store.setSupplier('focus-rose', 'wholesaler-b')

    expect(JSON.stringify(store.current?.purchase)).toBe(before)
  })

  it('prices a flower added afterwards from live prices', async () => {
    const { store } = await planned()
    store.markPurchased()
    store.togglePalette('focal', 'wax-flower')

    expect(flowerResult(store, 'wax-flower')?.offer?.frozen).toBeUndefined()
  })
})

describe('purchase screen', () => {
  async function screen() {
    const mounted = await planned('palette')
    await mounted.router.push(`/events/${mounted.store.current?.id}/purchase`)
    await flushPromises()
    return mounted
  }

  it('lists exactly the prices that will be frozen', async () => {
    const { wrapper, store } = await screen()
    const expected = store.allocation?.flowers.filter((item) => item.offer && item.stems > 0)

    expect(
      wrapper.findAll('[data-frozen-price]').map((item) => item.attributes('data-frozen-price')),
    ).toEqual(expected?.map((item) => item.flowerId))
    expect(wrapper.find('[data-frozen-price="focus-rose"]').text()).toContain('£')
  })

  it('names flowers with no price to freeze', async () => {
    const { wrapper, store } = await screen()
    const catalogue = useCatalogueStore()
    catalogue.prices = catalogue.prices.filter((price) => price.flowerId !== 'focus-rose')
    await flushPromises()

    expect(store.allocation?.flowers.some((item) => item.needsData)).toBe(true)
    expect(wrapper.find('[data-no-price]').text()).toContain(catalogue.flowerName('focus-rose'))
  })

  it('freezes on confirming, then offers a backup', async () => {
    const { wrapper, store } = await screen()
    await wrapper.find('.confirm-purchase').trigger('click')
    await flushPromises()

    expect(store.current?.purchase).toBeDefined()
    expect(wrapper.find('[data-backup-nudge] a').attributes('href')).toContain('/settings')
  })

  it('changes nothing on going back', async () => {
    const { wrapper, store, router } = await screen()
    await wrapper.find('.cancel-purchase').trigger('click')
    await flushPromises()

    expect(store.current?.purchase).toBeUndefined()
    expect(router.currentRoute.value.path).toContain('/review')
  })

  it('says so when the event is already purchased', async () => {
    const mounted = await planned('review')
    mounted.store.markPurchased()
    await mounted.router.push(`/events/${mounted.store.current?.id}/purchase`)
    await flushPromises()

    expect(mounted.wrapper.find('.confirm-purchase').exists()).toBe(false)
    expect(mounted.wrapper.text()).toContain('already purchased')
  })

  it('explains an event with nothing to buy', async () => {
    const { wrapper, router, store } = await mountEvent('review')
    await router.push(`/events/${store.current?.id}/purchase`)
    await flushPromises()

    expect(wrapper.find('.confirm-purchase').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nothing to buy')
  })
})

describe('after purchase', () => {
  it('offers purchase on Review only until it happens', async () => {
    const { wrapper, store } = await planned()

    expect(wrapper.find('.mark-purchased').exists()).toBe(true)
    store.markPurchased()
    await flushPromises()
    expect(wrapper.find('.mark-purchased').exists()).toBe(false)
  })

  it('shows what was spent and what edits add', async () => {
    const { wrapper, store } = await planned()
    store.markPurchased()
    await flushPromises()
    const summary = wrapper.find('[data-purchase-summary]')

    expect(summary.text()).toContain('Spent at purchase')
    expect(summary.find('[data-added-cost]').exists()).toBe(false)

    store.togglePalette('focal', 'hydrangea')
    setDesign(store, 'pedestal', 40)
    await flushPromises()

    expect(store.purchaseChanges.length).toBeGreaterThan(0)
    expect(wrapper.find('[data-added-cost]').exists()).toBe(true)
    expect(wrapper.find('[data-purchase-changes]').text()).toContain('after purchase')
  })

  it('keeps the spent amount when an edit needs less', async () => {
    const { store } = await planned()
    store.markPurchased()
    const spent = store.current?.purchase?.allocation.totals.costPence
    setDesign(store, 'pedestal', 1)

    expect(store.current?.purchase?.allocation.totals.costPence).toBe(spent)
    expect(store.addedCostPence).toBe(0)
  })

  it('replaces the supplier picker on frozen lines', async () => {
    const { wrapper, store } = await planned()
    store.markPurchased()
    await flushPromises()
    const line = wrapper.find('[data-order-line="focus-rose"]')

    expect(line.find('select').exists()).toBe(false)
    expect(line.text()).toContain('Frozen price')
  })

  it('badges a line added after purchase', async () => {
    const { wrapper, store } = await planned()
    store.markPurchased()
    store.togglePalette('focal', 'wax-flower')
    await flushPromises()

    expect(wrapper.find('[data-order-line="wax-flower"]').text()).toContain('Added after purchase')
    expect(wrapper.find('[data-order-line="focus-rose"]').text()).not.toContain('Added after')
  })

  it('flags designs changed since purchase', async () => {
    const { wrapper, store } = await planned('designs')
    store.markPurchased()
    await flushPromises()

    expect(wrapper.find('[data-design="pedestal"]').text()).not.toContain('after purchase')

    setDesign(store, 'pedestal', 3)
    setDesign(store, 'top-table', 1)
    await flushPromises()

    expect(wrapper.find('[data-design="pedestal"]').text()).toContain('Changed after purchase')
    expect(wrapper.find('[data-design="top-table"]').text()).toContain('Added after purchase')
  })

  it('shows Purchased in the event header and the event list', async () => {
    const { wrapper, store, router } = await planned()
    store.markPurchased()
    await flushPromises()
    expect(wrapper.find('.event-header').text()).toContain('Purchased')

    await router.push('/events')
    await flushPromises()
    expect(wrapper.find('.event-link').text()).toContain('Purchased')
  })
})

describe('duplicating a purchased event', () => {
  async function purchased() {
    const { store } = await planned()
    store.markPurchased()
    return store
  }

  it('clears purchase state and goes back to live prices by default', async () => {
    const store = await purchased()
    const id = store.duplicateEvent(store.current?.id ?? '', { name: 'Copy' })
    store.open(id ?? '')

    expect(store.current?.purchase).toBeUndefined()
    expect(store.current?.frozenPrices).toBeUndefined()
    expect(flowerResult(store, 'focus-rose')?.offer?.frozen).toBeUndefined()
  })

  it('can keep the frozen prices', async () => {
    const store = await purchased()
    const original = store.current
    const id = store.duplicateEvent(original?.id ?? '', { name: 'Copy' }, { keepFrozen: true })
    store.open(id ?? '')

    expect(store.current?.purchase).toBeUndefined()
    expect(store.current?.frozenPrices).toEqual(original?.frozenPrices)
    expect(flowerResult(store, 'focus-rose')?.offer?.frozen).toBe(true)
  })

  it('lets a copy with kept prices be purchased, holding them', async () => {
    const store = await purchased()
    const kept = store.current?.frozenPrices
    const id = store.duplicateEvent(store.current?.id ?? '', { name: 'Copy' }, { keepFrozen: true })
    store.open(id ?? '')

    expect(store.markPurchased()).toBe(true)
    expect(store.current?.frozenPrices).toEqual(kept)
  })

  it('forgets where a share came from and which prices were seen', async () => {
    const store = await purchased()
    store.notePricesViewed()
    const id = store.duplicateEvent(store.current?.id ?? '', { name: 'Copy' })
    store.open(id ?? '')

    expect(store.current?.viewedPrices).toBeUndefined()
  })

  it('offers the option only when there are prices to keep', async () => {
    const { wrapper, router, store } = await planned()
    const plain = store.current?.id
    await router.push('/events/new')
    await flushPromises()
    await wrapper.find('select[name="copy-from"]').setValue(plain)

    expect(wrapper.find('input[name="keep-frozen"]').exists()).toBe(false)

    store.open(plain ?? '')
    store.markPurchased()
    await flushPromises()

    expect(wrapper.find('input[name="keep-frozen"]').exists()).toBe(true)
    await wrapper.find('input[name="name"]').setValue('Again')
    await wrapper.find('input[name="keep-frozen"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(store.current?.name).toBe('Again')
    expect(store.current?.frozenPrices?.length).toBeGreaterThan(0)
  })
})

describe('price-changed notice', () => {
  let store: ReturnType<typeof useEventStore>
  let text: () => string

  async function seen() {
    const mounted = await planned()
    store = mounted.store
    await flushPromises()
    text = () => mounted.wrapper.text()
    return mounted
  }

  function raise(flowerId = 'focus-rose', pricePence = 123) {
    const catalogue = useCatalogueStore()
    const supplierId = flowerResult(store, flowerId)?.offer?.supplierId ?? ''
    catalogue.prices = [...catalogue.prices, livePrice(flowerId, pricePence, supplierId)]
  }

  beforeEach(() => localStorage.clear())

  it('stays away on a first view, which records the prices', async () => {
    await seen()

    expect(text()).not.toContain('Prices have changed')
    expect(store.current?.viewedPrices?.['focus-rose']).toBeDefined()
  })

  it('shows the old and new price once a price moves', async () => {
    const { wrapper } = await seen()
    raise()
    await flushPromises()
    const notice = wrapper.find('[data-price-changes]')

    expect(notice.text()).toContain('Prices have changed')
    expect(notice.text()).toContain('£1.23')
  })

  it('clears with Got it, and stays clear', async () => {
    const { wrapper } = await seen()
    raise()
    await flushPromises()
    await wrapper.find('.acknowledge-prices').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-price-changes]').exists()).toBe(false)
    expect(store.current?.viewedPrices?.['focus-rose']?.pricePence).toBe(123)
  })

  it('ignores a supplier picked by hand', async () => {
    const { wrapper } = await seen()
    const other = store
      .offersFor('focus-rose')
      .find((offer) => offer.supplierId !== flowerResult(store, 'focus-rose')?.offer?.supplierId)
    expect(other).toBeDefined()
    store.setSupplier('focus-rose', other?.supplierId ?? '')
    await flushPromises()

    expect(wrapper.find('[data-price-changes]').exists()).toBe(false)
  })

  it('never shows a frozen price', async () => {
    const { wrapper } = await seen()
    store.markPurchased()
    raise()
    await flushPromises()

    expect(wrapper.find('[data-price-changes]').exists()).toBe(false)
  })

  it('waits for saved prices before recording anything', async () => {
    await seen()
    const catalogue = useCatalogueStore()
    catalogue.pricesLoaded = false
    const before = store.current?.viewedPrices
    raise()
    store.notePricesViewed()

    expect(store.priceChanges).toEqual([])
    expect(store.current?.viewedPrices).toEqual(before)
  })

  it('survives leaving and coming back', async () => {
    const { wrapper, router } = await seen()
    const id = store.current?.id
    await router.push('/events')
    raise()
    await router.push(`/events/${id}/review`)
    await flushPromises()

    expect(wrapper.find('[data-price-changes]').exists()).toBe(true)
  })
})

describe('storing purchase data', () => {
  const event = (extra: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    id: 'event-1',
    name: 'June wedding',
    designs: [],
    palette: { focal: [], secondary: [], filler: [], foliage: [], accent: [] },
    supplierChoice: {},
    settings: { thinBunchPercent: 15, priceAmberDays: 14, priceRedDays: 30, bigChangePercent: 50 },
    ...extra,
  })
  const price = {
    flowerId: 'x',
    supplierId: 's',
    reportId: 'r',
    pricePence: 100,
    bunchSize: 10,
    reportedAt: '2026-06-01T00:00:00.000Z',
  }
  const snapshot = {
    purchasedAt: '2026-06-02T00:00:00.000Z',
    designs: [],
    palette: {},
    settings: {},
    allocation: { flowers: [], totals: { costPence: 0 } },
    prices: [price],
  }

  it('accepts an event from before purchases', () => {
    expect(migrateEvent(event())).toEqual(event())
  })

  it('accepts good purchase data', () => {
    const good = event({ purchase: snapshot, frozenPrices: [price] })

    expect(migrateEvent(good)).toEqual(good)
  })

  it.each([
    ['a purchase that is not a record', { purchase: 'yes' }],
    ['a purchase with no time', { purchase: { ...snapshot, purchasedAt: 7 } }],
    ['a purchase with no allocation', { purchase: { ...snapshot, allocation: null } }],
    ['a purchase with no totals', { purchase: { ...snapshot, allocation: { flowers: [] } } }],
    ['a purchase with no designs', { purchase: { ...snapshot, designs: 'x' } }],
    ['a purchase with a bad price', { purchase: { ...snapshot, prices: [{}] } }],
    ['frozen prices that are not a list', { frozenPrices: {} }],
    ['a frozen price in pounds', { frozenPrices: [{ ...price, pricePence: 1.5 }] }],
    ['a frozen price below zero', { frozenPrices: [{ ...price, pricePence: -1 }] }],
    ['a frozen bunch of nothing', { frozenPrices: [{ ...price, bunchSize: 0 }] }],
    ['a frozen price with no flower', { frozenPrices: [{ ...price, flowerId: 1 }] }],
    ['a frozen price with no date', { frozenPrices: [{ ...price, reportedAt: 'soon' }] }],
  ])('refuses %s', (_label, extra) => {
    expect(() => migrateEvent(event(extra))).toThrow('not a valid event')
  })

  it('keeps a purchase through a backup', async () => {
    await mountApp()
    const { store } = await planned()
    store.markPurchased()
    const current = JSON.parse(JSON.stringify(store.current)) as EventPlan

    expect(parseBackup(buildBackup([current], '2026-06-03T00:00:00.000Z'))).toEqual([current])
  })
})
