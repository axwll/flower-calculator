import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Warning } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import type { useEventStore } from '../stores/event'
import { warningText } from '../wording'
import { mountEvent } from './helpers'

type Store = ReturnType<typeof useEventStore>

function setDesign(store: Store, designId: string, quantity: number) {
  const index = store.current?.designs.findIndex((item) => item.designId === designId) ?? -1
  store.setEnabled(index, true)
  store.setQuantity(index, quantity)
}

function buildBridal(store: Store) {
  setDesign(store, 'bridal-bouquet', 1)
  setDesign(store, 'bridesmaid-bouquet', 7)
  setDesign(store, 'groom', 1)
  setDesign(store, 'buttonhole', 4)
  setDesign(store, 'corsage', 2)
}

function buildReception(store: Store) {
  setDesign(store, 'top-table', 1)
  setDesign(store, 'pedestal', 2)
  setDesign(store, 'half-moon-hoop', 1)
  setDesign(store, 'pumpkin', 3)
  setDesign(store, 'pumpkin-posey', 2)
  setDesign(store, 'table-vases', 11)
  for (const id of ['chrysanthemum-blooms', 'focus-rose']) store.togglePalette('focal', id)
  for (const id of ['lisianthus', 'orange-rose']) store.togglePalette('secondary', id)
  for (const id of ['alstroemeria', 'burgundy-carnation', 'santini']) {
    store.togglePalette('filler', id)
  }
}

function line(wrapper: VueWrapper, flowerId: string) {
  return wrapper.find(`[data-order-line="${flowerId}"]`)
}

describe('review: the sample wedding', () => {
  it('shows the bridal figures worked out by hand in Phase 1', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildBridal(store)
    await flushPromises()

    expect(line(wrapper, 'focus-rose').text()).toContain('39 stems')
    expect(line(wrapper, 'focus-rose').text()).toContain('1 × 48')
    expect(line(wrapper, 'focus-rose').text()).toContain('9 spare')
    expect(line(wrapper, 'focus-rose').text()).toContain('£40.00')
    expect(line(wrapper, 'ms-rose').text()).toContain('2 × 10')
    expect(wrapper.find('[data-grand-total]').text()).toContain('£116.00')
  })

  it('shows the reception figures worked out by hand in Phase 1', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildReception(store)
    await flushPromises()

    expect(line(wrapper, 'alstroemeria').text()).toContain('53 stems')
    expect(line(wrapper, 'alstroemeria').text()).toContain('£36.00')
    expect(wrapper.find('[data-grand-total]').text()).toContain('£305.00')
    expect(store.allocation?.totals).toMatchObject({ stems: 244, spareStems: 119 })
  })
})

describe('review: order list', () => {
  it('groups by supplier with subtotals', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildBridal(store)
    await flushPromises()
    const groups = wrapper.findAll('[data-supplier]')

    expect(groups.map((group) => group.find('h3').text())).toEqual([
      'Supermarket C',
      'Wholesaler A',
    ])
    expect(groups[0]?.text()).toContain('£16.00')
    expect(groups[1]?.text()).toContain('£100.00')
  })

  it('says when there is nothing to order', async () => {
    const { wrapper } = await mountEvent('review')

    expect(wrapper.text()).toContain('Nothing to order yet')
  })

  it('warns about a thin bunch on its line', async () => {
    const { wrapper, store } = await mountEvent('review')
    const catalogue = useCatalogueStore()
    catalogue.recipes = [
      ...catalogue.recipes,
      {
        designId: 'groom',
        size: 'Large',
        lines: [{ kind: 'named', flowerId: 'spray-carnation', stemsPerUnit: 11 }],
        version: 1,
      },
    ]
    setDesign(store, 'groom', 1)
    const groom = store.current?.designs.findIndex((item) => item.designId === 'groom') ?? -1
    store.setSize(groom, 'Large')
    await flushPromises()

    expect(line(wrapper, 'spray-carnation').text()).toContain('Thin bunch')
  })

  it('offers a supplier change only when there is a choice', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildBridal(store)
    await flushPromises()

    expect(line(wrapper, 'focus-rose').find('select').exists()).toBe(true)
    expect(line(wrapper, 'ms-rose').find('select').exists()).toBe(false)
  })

  it('changes supplier and back again', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildBridal(store)
    await flushPromises()
    await line(wrapper, 'focus-rose').find('select').setValue('wholesaler-b')

    expect(store.current?.supplierChoice).toEqual({ 'focus-rose': 'wholesaler-b' })
    expect(wrapper.find('[data-grand-total]').text()).toContain('£120.00')

    await line(wrapper, 'focus-rose').find('select').setValue('')

    expect(store.current?.supplierChoice).toEqual({})
    expect(wrapper.find('[data-grand-total]').text()).toContain('£116.00')
  })

  it('flags a stale price in the supplier choice', async () => {
    const { wrapper, store } = await mountEvent('review')
    const catalogue = useCatalogueStore()
    catalogue.prices = catalogue.prices.map((price) =>
      price.id === 'seed-focus-rose-wholesaler-b'
        ? { ...price, pricePence: 100, reportedAt: '2020-01-01T00:00:00.000Z' }
        : price,
    )
    buildBridal(store)
    await flushPromises()
    const options = line(wrapper, 'focus-rose').findAll('option')

    expect(options.map((option) => option.text()).join(' ')).toContain('old price')
    expect(
      store.allocation?.flowers.find((item) => item.flowerId === 'focus-rose')?.offer,
    ).toMatchObject({ supplierId: 'wholesaler-a' })
  })
})

describe('review: gather list', () => {
  async function withForaged() {
    const mounted = await mountEvent('review')
    const catalogue = useCatalogueStore()
    catalogue.flowers = catalogue.flowers.map((flower) =>
      flower.id === 'wax-flower' ? { ...flower, soldAs: 'foraged' } : flower,
    )
    setDesign(mounted.store, 'groom', 1)
    await flushPromises()
    return mounted
  }

  it('lists foraged flowers', async () => {
    const { wrapper } = await withForaged()

    expect(wrapper.find('[data-gather="wax-flower"]').text()).toContain('1 stem')
  })

  it('keeps a note with its line', async () => {
    const { wrapper, store } = await withForaged()
    await wrapper.find('[data-gather="wax-flower"] input').setValue('From the lane')

    expect(store.current?.gatherNotes).toEqual({ 'wax-flower': 'From the lane' })
  })

  it('stays hidden with nothing to gather', async () => {
    const { wrapper } = await mountEvent('review')

    expect(wrapper.find('[data-gather-list]').exists()).toBe(false)
  })
})

describe('review: leftovers', () => {
  it('shows spare stems per flower', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildBridal(store)
    await flushPromises()

    expect(wrapper.find('[data-leftovers]').text()).toContain('Focus rose (white): 9 spare stems')
  })

  it('shows the vase pool for information', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildReception(store)
    await flushPromises()

    expect(wrapper.find('[data-leftovers]').text()).toContain(
      '11 Table vases: about 10.8 stems each',
    )
  })

  it('never calls anything true waste', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildReception(store)
    await flushPromises()

    expect(wrapper.text().toLowerCase()).not.toContain('waste')
  })
})

describe('review: warnings', () => {
  it('says when there are none', async () => {
    const { wrapper } = await mountEvent('review')

    expect(wrapper.find('[data-warnings]').text()).toContain('No warnings')
  })

  it('counts flowers missing prices', async () => {
    const { wrapper, store } = await mountEvent('review')
    buildBridal(store)
    await flushPromises()

    expect(wrapper.find('[data-warnings]').text()).toContain('4 flowers missing prices')
  })

  it('reports unassigned stems', async () => {
    const { wrapper, store } = await mountEvent('review')
    setDesign(store, 'top-table', 1)
    await flushPromises()

    expect(wrapper.find('[data-warnings]').text()).toContain(
      'No flowers ticked for focal in Top table: 7 stems unassigned.',
    )
  })
})

describe('warningText', () => {
  const names = {
    flowerName: (id: string) => `flower ${id}`,
    supplierName: (id: string) => `supplier ${id}`,
    designName: (id: string) => `design ${id}`,
  }

  it.each<[Warning, string]>([
    [
      { code: 'no-flowers-for-role', designIndex: 0, designId: 'd', role: 'filler', stems: 1 },
      'No flowers ticked for filler in design d: 1 stem unassigned.',
    ],
    [
      { code: 'needs-data', flowerId: 'f', stems: 3, reason: 'no-price' },
      'flower f has no price yet: 3 stems counted but not costed.',
    ],
    [
      { code: 'needs-data', flowerId: 'f', stems: 3, reason: 'no-bunch-size' },
      'flower f has no bunch size yet: 3 stems counted but not costed.',
    ],
    [
      { code: 'needs-data', flowerId: 'f', stems: 3, reason: 'override-unavailable' },
      'flower f has no price from the chosen supplier: 3 stems counted but not costed.',
    ],
    [
      { code: 'needs-data', flowerId: 'f', stems: 3, reason: 'unknown-flower' },
      'flower f is not in the flower list: 3 stems counted but not costed.',
    ],
    [
      { code: 'stale-price', flowerId: 'f', supplierId: 's', reportId: 'r', ageDays: 40.6 },
      'flower f: the price from supplier s is 40 days old.',
    ],
    [
      { code: 'thin-bunch', flowerId: 'f', lastBunchStems: 1, bunchSize: 10 },
      'flower f: only 1 of the 10 stems in the last bunch is used.',
    ],
    [
      { code: 'supplier-changed', flowerId: 'f', fromSupplierId: 'a', toSupplierId: 'b' },
      'flower f: moved to supplier b, which is cheaper once every stem is counted.',
    ],
  ])('words %j', (warning, text) => {
    expect(warningText(warning, names)).toBe(text)
  })
})
