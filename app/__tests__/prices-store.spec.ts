import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setApiClient } from '../api/client'
import type { ApiAction, ApiClient, SendResult } from '../api/client'
import { isBigChange } from '../pricing'
import { memoryPriceStorage, setPriceStorage } from '../storage/priceStorage'
import type { PriceStorage } from '../storage/priceStorage'
import { useCatalogueStore } from '../stores/catalogue'
import { usePricesStore } from '../stores/prices'

const FORM = {
  flowerId: 'focus-rose',
  supplierId: 'wholesaler-a',
  pricePence: 4500,
  stemsPerBunch: 48,
}

function fakeClient(result: SendResult = { status: 'sent' }) {
  const sent: ApiAction[] = []
  const client: ApiClient & { sent: ApiAction[]; result: SendResult } = {
    sent,
    result,
    fetchMaster: async () => ({ status: 'unchanged' }),
    send: async (action) => {
      sent.push(action)
      return client.result
    },
  }
  return client
}

let storage: PriceStorage
let client: ReturnType<typeof fakeClient>

async function open() {
  setActivePinia(createPinia())
  const prices = usePricesStore()
  await prices.start()
  return prices
}

async function reportOnline() {
  const prices = await open()
  prices.setNickname('Sam')
  await prices.report(FORM)
  await flushPromises()
  return prices
}

function currentPrice() {
  return useCatalogueStore()
    .activePrices.filter(
      (price) =>
        price.flowerId === FORM.flowerId &&
        price.supplierId === FORM.supplierId &&
        price.status === 'active',
    )
    .at(-1)?.pricePence
}

beforeEach(() => {
  localStorage.clear()
  storage = memoryPriceStorage()
  setPriceStorage(storage)
  client = fakeClient()
  setApiClient(client)
})

afterEach(() => {
  setApiClient(null)
  setPriceStorage(null)
  vi.restoreAllMocks()
})

describe('isBigChange', () => {
  it.each([
    [1000, 1500, false],
    [1000, 1501, true],
    [1000, 500, false],
    [1000, 499, true],
    [1000, 10000, true],
  ])('compares %i with %i', (before, after, big) => {
    expect(isBigChange(before, after, 50)).toBe(big)
  })

  it('does not ask when there was no price to compare', () => {
    expect(isBigChange(0, 500, 50)).toBe(false)
  })
})

describe('nickname and admin key', () => {
  it('survives reopening', async () => {
    const prices = await open()
    prices.setNickname('  Sam ')
    prices.setAdminKey('secret')

    const reopened = await open()

    expect(reopened.nickname).toBe('Sam')
    expect(reopened.adminKey).toBe('secret')
  })

  it('still works when the browser blocks storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked')
    })
    const prices = await open()
    prices.setNickname('Sam')

    expect(prices.nickname).toBe('Sam')
  })
})

describe('reporting a price', () => {
  it('sends the report with a nickname and the time it was made', async () => {
    await reportOnline()
    const [action] = client.sent

    expect(action).toMatchObject({
      action: 'reportPrice',
      report: { ...FORM, reportedBy: 'Sam', status: 'active' },
    })
    expect(
      action?.action === 'reportPrice' && Date.parse(action.report.reportedAt),
    ).toBeGreaterThan(0)
  })

  it('shows the new price', async () => {
    await reportOnline()

    expect(currentPrice()).toBe(4500)
  })

  it('leaves nothing queued once sent', async () => {
    const prices = await reportOnline()

    expect(prices.queue).toEqual([])
    expect(await storage.loadQueue()).toEqual([])
  })

  it('gives each report its own id', async () => {
    const prices = await reportOnline()
    await prices.report(FORM)

    const ids = client.sent.map((action) => action.action === 'reportPrice' && action.report.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('refreshes after sending', async () => {
    const fetchMaster = vi.spyOn(client, 'fetchMaster')
    await reportOnline()

    expect(fetchMaster).toHaveBeenCalled()
  })
})

describe('offline queue', () => {
  beforeEach(() => {
    client.result = { status: 'retry' }
  })

  it('keeps a report queued, and shows the price at once', async () => {
    const prices = await reportOnline()

    expect(prices.queue).toHaveLength(1)
    expect(currentPrice()).toBe(4500)
    expect(prices.isPending(prices.queue[0]?.id ?? '')).toBe(true)
  })

  it('survives closing the app', async () => {
    await reportOnline()

    const reopened = await open()

    expect(reopened.queue).toHaveLength(1)
    expect(currentPrice()).toBe(4500)
  })

  it('sends on reopening, with the original time', async () => {
    await reportOnline()
    const [first] = client.sent
    client.sent.length = 0
    client.result = { status: 'sent' }

    const reopened = await open()
    await flushPromises()

    expect(reopened.queue).toEqual([])
    expect(client.sent[0]).toEqual(first)
  })

  it('sends when the connection returns', async () => {
    const prices = await reportOnline()
    client.result = { status: 'sent' }
    window.dispatchEvent(new Event('online'))
    await flushPromises()

    expect(prices.queue).toEqual([])
  })

  it('keeps the order reports were made in', async () => {
    const prices = await reportOnline()
    await prices.report({ ...FORM, pricePence: 4600 })
    client.sent.length = 0
    client.result = { status: 'sent' }
    await prices.flush()

    expect(
      client.sent.map((action) => action.action === 'reportPrice' && action.report.pricePence),
    ).toEqual([4500, 4600])
  })

  it('stops at the first failure, to keep that order', async () => {
    const prices = await reportOnline()
    await prices.report({ ...FORM, pricePence: 4600 })
    client.sent.length = 0
    await prices.flush()

    expect(client.sent).toHaveLength(1)
  })

  it('also sends a report made while another is being sent', async () => {
    const prices = await open()
    prices.setNickname('Sam')
    client.result = { status: 'sent' }
    const send = client.send
    client.send = async (action) => {
      client.send = send
      await prices.report({ ...FORM, pricePence: 4600 })
      return send(action)
    }
    await prices.report(FORM)
    await flushPromises()

    expect(prices.queue).toEqual([])
    expect(client.sent).toHaveLength(2)
  })

  it('never sends twice at once', async () => {
    const prices = await reportOnline()
    client.sent.length = 0
    client.result = { status: 'sent' }
    await Promise.all([prices.flush(), prices.flush()])

    expect(client.sent).toHaveLength(1)
  })
})

describe('a refused report', () => {
  it('stops retrying and tells the person', async () => {
    client.result = { status: 'refused', message: 'Unknown flower.' }
    const prices = await reportOnline()

    expect(prices.queue).toEqual([])
    expect(prices.refused).toEqual([{ id: expect.any(String), message: 'Unknown flower.' }])
  })

  it('removes the price it had shown', async () => {
    client.result = { status: 'refused', message: 'No.' }
    await reportOnline()

    expect(currentPrice()).not.toBe(4500)
  })

  it('can be dismissed', async () => {
    client.result = { status: 'refused', message: 'No.' }
    const prices = await reportOnline()
    prices.dismissRefused(prices.refused[0]?.id ?? '')

    expect(prices.refused).toEqual([])
  })
})

describe('voiding', () => {
  function reportId() {
    return useCatalogueStore()
      .activePrices.filter((price) => price.reportedBy === 'Sam')
      .at(-1)?.id as string
  }

  it('sends the void and restores the previous price', async () => {
    const before = (await open(), currentPrice())
    const prices = await reportOnline()
    await prices.voidReport(reportId())

    expect(client.sent.at(-1)).toMatchObject({ action: 'voidPrice', nickname: 'Sam' })
    expect(currentPrice()).toBe(before)
  })

  it('sends the admin key when one is set', async () => {
    const prices = await reportOnline()
    prices.setAdminKey('secret')
    await prices.voidReport(reportId())

    expect(client.sent.at(-1)).toMatchObject({ adminKey: 'secret' })
  })

  it('leaves the admin key out otherwise', async () => {
    const prices = await reportOnline()
    await prices.voidReport(reportId())

    expect(client.sent.at(-1)).not.toHaveProperty('adminKey')
  })

  it('works offline, then sends', async () => {
    const before = (await open(), currentPrice())
    const prices = await reportOnline()
    const id = reportId()
    client.result = { status: 'retry' }
    await prices.voidReport(id)

    expect(prices.queue).toHaveLength(1)
    expect(currentPrice()).toBe(before)

    client.result = { status: 'sent' }
    await prices.flush()

    expect(prices.queue).toEqual([])
    expect(currentPrice()).toBe(before)
  })

  it('cancels a report that was never sent, without telling the server', async () => {
    const before = (await open(), currentPrice())
    client.result = { status: 'retry' }
    const prices = await reportOnline()
    client.sent.length = 0
    await prices.voidReport(prices.queue[0]?.id ?? '')

    expect(client.sent).toEqual([])
    expect(prices.queue).toEqual([])
    expect(currentPrice()).toBe(before)
  })

  it('puts the price back if a void is refused', async () => {
    const prices = await reportOnline()
    client.result = { status: 'refused', message: 'Only the person who reported it can.' }
    await prices.voidReport(reportId())

    expect(currentPrice()).toBe(4500)
    expect(prices.refused).toHaveLength(1)
  })
})

describe('canVoid', () => {
  const report = { reportedBy: 'Sam', status: 'active' as const }

  it('allows your own report', async () => {
    const prices = await open()
    prices.setNickname('Sam')

    expect(prices.canVoid(report)).toBe(true)
  })

  it("refuses someone else's", async () => {
    const prices = await open()
    prices.setNickname('Jo')

    expect(prices.canVoid(report)).toBe(false)
  })

  it('allows anything with an admin key', async () => {
    const prices = await open()
    prices.setNickname('Jo')
    prices.setAdminKey('secret')

    expect(prices.canVoid(report)).toBe(true)
  })

  it('refuses with no nickname', async () => {
    const prices = await open()

    expect(prices.canVoid({ reportedBy: '', status: 'active' })).toBe(false)
  })

  it('refuses a report that is already voided', async () => {
    const prices = await open()
    prices.setNickname('Sam')

    expect(prices.canVoid({ ...report, status: 'voided' })).toBe(false)
  })
})
