import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setApiClient } from '../api/client'
import type { ApiAction } from '../api/client'
import { useCatalogueStore } from '../stores/catalogue'
import { usePricesStore } from '../stores/prices'
import { mountApp } from './helpers'

const DAY = 86_400_000
let sent: ApiAction[]

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY).toISOString()
}

function ageAllPrices(days: number) {
  const catalogue = useCatalogueStore()
  catalogue.prices = catalogue.prices.map((price) => ({ ...price, reportedAt: daysAgo(days) }))
}

async function openForm(path = '/prices/focus-rose') {
  const mounted = await mountApp(path)
  usePricesStore().setNickname('Sam')
  await flushPromises()
  return mounted
}

async function fillForm(wrapper: VueWrapper, price: string) {
  await wrapper.find('input[name="price"]').setValue(price)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  sent = []
  setApiClient({
    fetchMaster: async () => ({ status: 'unchanged' }),
    send: async (action) => {
      sent.push(action)
      return { status: 'sent' }
    },
  })
})

afterEach(() => {
  setApiClient(null)
  vi.restoreAllMocks()
})

describe('prices tab', () => {
  it('lists bought flowers with their latest price per supplier', async () => {
    const { wrapper } = await mountApp('/prices')
    const row = wrapper.find('[data-price-flower="focus-rose"]')

    expect(row.text()).toContain('Focus rose (white)')
    expect(row.text()).toContain('Wholesaler A')
    expect(row.text()).toContain('£40.00')
    expect(row.text()).toContain('Wholesaler B')
  })

  it('finds flowers by name', async () => {
    const { wrapper } = await mountApp('/prices')
    await wrapper.find('input[name="search"]').setValue('dahlia')

    expect(
      wrapper.findAll('[data-price-flower]').map((row) => row.attributes('data-price-flower')),
    ).toEqual(['dahlia-dark', 'dahlia-orange', 'dahlia-peachy'])
  })

  it('says when nothing matches', async () => {
    const { wrapper } = await mountApp('/prices')
    await wrapper.find('input[name="search"]').setValue('zzz')

    expect(wrapper.text()).toContain('No flowers match')
  })

  it('shows flowers with no price', async () => {
    const { wrapper } = await mountApp('/prices')

    expect(wrapper.find('[data-price-flower="scabious"]').text()).toContain('No price yet')
  })

  it.each([
    [13, '13 days', 'age-fresh'],
    [15, '15 days', 'age-amber'],
    [29, '29 days', 'age-amber'],
    [31, '31 days', 'age-red'],
  ])('colours a %i day old price', async (days, text, cssClass) => {
    const { wrapper } = await mountApp('/prices')
    ageAllPrices(days)
    await flushPromises()
    const age = wrapper.find('[data-price-flower="focus-rose"] .price-age')

    expect(age.text()).toBe(text)
    expect(age.classes()).toContain(cssClass)
  })

  it('says today for a new price', async () => {
    const { wrapper } = await mountApp('/prices')

    expect(wrapper.find('[data-price-flower="focus-rose"] .price-age').text()).toBe('Today')
  })

  it('says when prices may be out of date', async () => {
    setApiClient({
      fetchMaster: async () => ({ status: 'failed' }),
      send: async () => ({ status: 'retry' }),
    })
    const { wrapper } = await mountApp('/prices')

    expect(wrapper.text()).toContain('may be out of date')
  })

  it('counts updates waiting to send', async () => {
    setApiClient({
      fetchMaster: async () => ({ status: 'failed' }),
      send: async () => ({ status: 'retry' }),
    })
    const { wrapper } = await mountApp('/prices')
    const prices = usePricesStore()
    prices.setNickname('Sam')
    await prices.report({
      flowerId: 'focus-rose',
      supplierId: 'wholesaler-a',
      pricePence: 4500,
      stemsPerBunch: 48,
    })
    await flushPromises()

    expect(wrapper.text()).toContain('1 update pending sync')
  })

  it('shows a refused update, which can be dismissed', async () => {
    const { wrapper } = await mountApp('/prices')
    usePricesStore().refused.push({ id: 'r1', message: 'Unknown flower.' })
    await flushPromises()

    expect(wrapper.text()).toContain('Unknown flower.')

    await wrapper.find('button.dismiss-refused').trigger('click')

    expect(wrapper.text()).not.toContain('Unknown flower.')
  })

  it('leaves foraged flowers out, as they are never priced', async () => {
    const { wrapper } = await mountApp('/prices')
    const catalogue = useCatalogueStore()
    catalogue.flowers = catalogue.flowers.map((flower) =>
      flower.id === 'scabious' ? { ...flower, soldAs: 'foraged' } : flower,
    )
    await flushPromises()

    expect(wrapper.find('[data-price-flower="scabious"]').exists()).toBe(false)
  })
})

describe('price form', () => {
  it('prefills from the current price', async () => {
    const { wrapper } = await openForm()

    expect((wrapper.find('input[name="price"]').element as HTMLInputElement).value).toBe('40.00')
    expect((wrapper.find('input[name="stems"]').element as HTMLInputElement).value).toBe('48')
    expect((wrapper.find('select[name="supplier"]').element as HTMLSelectElement).value).toBe(
      'wholesaler-a',
    )
  })

  it('prefills when another supplier is chosen', async () => {
    const { wrapper } = await openForm()
    await wrapper.find('select[name="supplier"]').setValue('wholesaler-b')

    expect((wrapper.find('input[name="price"]').element as HTMLInputElement).value).toBe('44.00')
  })

  it('starts from the supplier in the address', async () => {
    const { wrapper } = await openForm('/prices/focus-rose?supplier=wholesaler-b')

    expect((wrapper.find('select[name="supplier"]').element as HTMLSelectElement).value).toBe(
      'wholesaler-b',
    )
  })

  it('leaves supplier choice open for a flower with no price', async () => {
    const { wrapper } = await openForm('/prices/scabious')

    expect((wrapper.find('input[name="price"]').element as HTMLInputElement).value).toBe('')
  })

  it('reports the price with its note and offer date', async () => {
    const { wrapper } = await openForm()
    await wrapper.find('input[name="note"]').setValue('offer on')
    await wrapper.find('input[name="offer-ends"]').setValue('2026-07-01')
    await fillForm(wrapper, '£42.50')

    expect(sent[0]).toMatchObject({
      action: 'reportPrice',
      report: {
        flowerId: 'focus-rose',
        supplierId: 'wholesaler-a',
        pricePence: 4250,
        stemsPerBunch: 48,
        note: 'offer on',
        offerEndsAt: '2026-07-01T23:59:59.999Z',
        reportedBy: 'Sam',
      },
    })
  })

  it('leaves empty extras out', async () => {
    const { wrapper } = await openForm()
    await fillForm(wrapper, '42')
    const report = sent[0]?.action === 'reportPrice' ? sent[0].report : null

    expect(report).not.toHaveProperty('note')
    expect(report).not.toHaveProperty('offerEndsAt')
  })

  it('goes back to the prices list once saved', async () => {
    const { wrapper, router } = await openForm()
    await fillForm(wrapper, '42')

    expect(router.currentRoute.value.path).toBe('/prices')
  })

  it('goes back to the shop once saved from there', async () => {
    const { wrapper, router } = await openForm('/prices/focus-rose?supplier=wholesaler-a&from=shop')
    await fillForm(wrapper, '42')

    expect(router.currentRoute.value.fullPath).toBe('/prices/shop?supplier=wholesaler-a')
  })

  it.each([['abc'], ['1.234'], ['-5'], ['']])('refuses a price of %j', async (price) => {
    const { wrapper } = await openForm()
    await fillForm(wrapper, price)

    expect(wrapper.text()).toContain('Enter the price in pounds')
    expect(sent).toEqual([])
  })

  it('refuses a bad bunch size', async () => {
    const { wrapper } = await openForm()
    await wrapper.find('input[name="stems"]').setValue('0')
    await fillForm(wrapper, '42')

    expect(wrapper.text()).toContain('Enter how many stems')
    expect(sent).toEqual([])
  })

  it('hides the bunch size for a stem-sold flower', async () => {
    const { wrapper } = await mountApp('/prices')
    const catalogue = useCatalogueStore()
    catalogue.flowers = catalogue.flowers.map((flower) =>
      flower.id === 'scabious' ? { ...flower, soldAs: 'stem' } : flower,
    )
    usePricesStore().setNickname('Sam')
    const { router } = { router: wrapper.vm.$router }
    await router.push('/prices/scabious')
    await flushPromises()

    expect(wrapper.find('input[name="stems"]').exists()).toBe(false)
  })

  it('asks for a nickname first', async () => {
    const { wrapper } = await mountApp('/prices/focus-rose')

    expect(wrapper.text()).toContain('Add your nickname')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('needs no confirmation at exactly 50%', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper } = await openForm()
    await fillForm(wrapper, '60')

    expect(confirm).not.toHaveBeenCalled()
    expect(sent).toHaveLength(1)
  })

  it('asks just over 50%', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper } = await openForm()
    await fillForm(wrapper, '60.01')

    expect(confirm).toHaveBeenCalledWith('Was £40.00, now £60.01. Is that right?')
    expect(sent).toHaveLength(1)
  })

  it('sends nothing when the big change is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper } = await openForm()
    await fillForm(wrapper, '400')

    expect(sent).toEqual([])
  })
})

describe('voiding from a flower page', () => {
  async function withReport(reportedBy: string) {
    const mounted = await openForm()
    const catalogue = useCatalogueStore()
    catalogue.prices = [
      ...catalogue.prices,
      {
        id: 'r1',
        flowerId: 'focus-rose',
        supplierId: 'wholesaler-a',
        pricePence: 3900,
        stemsPerBunch: 48,
        reportedAt: new Date().toISOString(),
        reportedBy,
        status: 'active',
      },
    ]
    await flushPromises()
    return mounted
  }

  it('offers to void your own report', async () => {
    const { wrapper } = await withReport('Sam')

    expect(wrapper.find('[data-report="r1"] button.void-report').exists()).toBe(true)
  })

  it("hides it on someone else's", async () => {
    const { wrapper } = await withReport('Jo')

    expect(wrapper.find('[data-report="r1"]').text()).toContain('Jo')
    expect(wrapper.find('[data-report="r1"] button.void-report').exists()).toBe(false)
  })

  it('shows it to anyone with the admin key', async () => {
    const { wrapper } = await withReport('Jo')
    usePricesStore().setAdminKey('secret')
    await flushPromises()

    expect(wrapper.find('[data-report="r1"] button.void-report').exists()).toBe(true)
  })

  it('asks first, then the previous price comes back', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper } = await withReport('Sam')

    expect(wrapper.find('[data-current-offer]').text()).toContain('£39.00')

    await wrapper.find('[data-report="r1"] button.void-report').trigger('click')
    await flushPromises()

    expect(sent.at(-1)).toMatchObject({ action: 'voidPrice', reportId: 'r1' })
    expect(wrapper.find('[data-current-offer]').text()).toContain('£40.00')
  })

  it('does nothing if the void is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper } = await withReport('Sam')
    await wrapper.find('[data-report="r1"] button.void-report').trigger('click')

    expect(sent).toEqual([])
  })

  it('marks a report still waiting to send', async () => {
    setApiClient({
      fetchMaster: async () => ({ status: 'failed' }),
      send: async () => ({ status: 'retry' }),
    })
    const { wrapper } = await openForm()
    await fillForm(wrapper, '41')
    await wrapper.vm.$router.push('/prices/focus-rose')
    await flushPromises()

    expect(wrapper.find('[data-report-history]').text()).toContain('Pending sync')
  })
})

describe('shop mode', () => {
  it('opens from the prices tab', async () => {
    const { wrapper } = await mountApp('/prices')

    expect(wrapper.find('a[href="/prices/shop"]').exists()).toBe(true)
  })

  it('asks which supplier first', async () => {
    const { wrapper } = await mountApp('/prices/shop')

    expect(
      wrapper.findAll('select[name="shop-supplier"] option').map((item) => item.text()),
    ).toEqual(['Choose a supplier', 'Supermarket C', 'Wholesaler A', 'Wholesaler B'])
    expect(wrapper.findAll('[data-shop-flower]')).toHaveLength(0)
  })

  it("shows only that supplier's flowers, with last prices", async () => {
    const { wrapper } = await mountApp('/prices/shop')
    await wrapper.find('select[name="shop-supplier"]').setValue('wholesaler-b')
    const rows = wrapper.findAll('[data-shop-flower]')

    expect(rows.map((row) => row.attributes('data-shop-flower'))).toEqual([
      'alstroemeria',
      'focus-rose',
      'hydrangea',
      'lisianthus',
    ])
    expect(rows[1]?.text()).toContain('£44.00')
  })

  it('keeps the supplier in the address, so going back stays there', async () => {
    const { wrapper } = await mountApp('/prices/shop?supplier=wholesaler-b')

    expect((wrapper.find('select[name="shop-supplier"]').element as HTMLSelectElement).value).toBe(
      'wholesaler-b',
    )
  })

  it('links each flower to a prefilled form', async () => {
    const { wrapper } = await mountApp('/prices/shop?supplier=wholesaler-b')

    expect(wrapper.find('[data-shop-flower="hydrangea"]').attributes('href')).toBe(
      '/prices/hydrangea?supplier=wholesaler-b&from=shop',
    )
  })

  it('leaves out inactive suppliers', async () => {
    const { wrapper } = await mountApp('/prices/shop')
    const catalogue = useCatalogueStore()
    catalogue.suppliers = catalogue.suppliers.map((supplier) =>
      supplier.id === 'supermarket-c' ? { ...supplier, active: false } : supplier,
    )
    await flushPromises()

    expect(wrapper.find('select[name="shop-supplier"]').text()).not.toContain('Supermarket C')
  })
})

describe('settings: identity', () => {
  it('saves a nickname', async () => {
    const { wrapper } = await mountApp('/settings')
    await wrapper.find('input[name="nickname"]').setValue('Sam')

    expect(usePricesStore().nickname).toBe('Sam')
  })

  it('saves an admin key without showing it', async () => {
    const { wrapper } = await mountApp('/settings')
    const input = wrapper.find('input[name="admin-key"]')
    await input.setValue('secret')

    expect(usePricesStore().adminKey).toBe('secret')
    expect(input.attributes('type')).toBe('password')
  })
})
