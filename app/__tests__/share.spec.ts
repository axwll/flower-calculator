import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EventPlan } from '@engine'

import { offlineClient, setApiClient } from '../api/client'
import type { ApiClient } from '../api/client'
import { decodePlan, encodePlan } from '../share/codec'
import { shareIdFrom, shareLink, sharePlan } from '../share/share'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { mountApp, mountEvent, setDesign } from './helpers'

/** Compression runs off the microtask queue, so promises alone don't cover it. */
async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 10))
  await flushPromises()
}

const SHARE_ID = '5f2a9c1e-7a4b-4c3d-9e21-8b6f0d1a2c34'

function fakeServer(overrides: Partial<ApiClient> = {}) {
  const stored = new Map<string, string>()
  const server: ApiClient & { stored: Map<string, string> } = {
    ...offlineClient,
    stored,
    sharePlan: async (payload) => {
      stored.set(SHARE_ID, payload)
      return { status: 'shared', id: SHARE_ID }
    },
    fetchShared: async (id) => {
      const payload = stored.get(id)
      return payload ? { status: 'ok', payload } : { status: 'not-found' }
    },
    ...overrides,
  }
  setApiClient(server)
  return server
}

async function purchasedPlan() {
  const mounted = await mountEvent('review')
  setDesign(mounted.store, 'pedestal', 2)
  mounted.store.togglePalette('focal', 'focus-rose')
  mounted.store.markPurchased()
  await settled()
  return mounted
}

function plain(event: EventPlan | null) {
  return JSON.parse(JSON.stringify(event)) as EventPlan
}

async function storedPlan(event: EventPlan) {
  const payload = await encodePlan(event)
  return fakeServer({ fetchShared: async () => ({ status: 'ok', payload }) })
}

afterEach(() => {
  setApiClient(null)
  vi.unstubAllGlobals()
})

describe('shareIdFrom', () => {
  it.each([
    ['a full link', `https://example.test/flower-calculator/#/shared/${SHARE_ID}`],
    ['a link with spaces around it', `  https://example.test/#/shared/${SHARE_ID}\n`],
    ['just the id', SHARE_ID],
  ])('finds the id in %s', (_label, text) => {
    expect(shareIdFrom(text)).toBe(SHARE_ID)
  })

  it.each([
    ['nothing', ''],
    ['a short word', 'hello'],
    ['another page', 'https://example.test/#/events'],
    ['odd characters', '5f2a9c1e 7a4b <script>'],
  ])('finds nothing in %s', (_label, text) => {
    expect(shareIdFrom(text)).toBeNull()
  })
})

describe('shareLink', () => {
  it('points at the shared route', () => {
    expect(shareLink(SHARE_ID)).toContain(`#/shared/${SHARE_ID}`)
  })
})

describe('sharePlan', () => {
  it('sends the compressed plan and returns a link', async () => {
    const server = fakeServer()
    const { store } = await purchasedPlan()
    const result = await sharePlan(plain(store.current))

    expect(result).toEqual({ status: 'shared', link: shareLink(SHARE_ID) })
    expect(await decodePlan(server.stored.get(SHARE_ID) ?? '')).toMatchObject({
      id: store.current?.id,
    })
  })

  it('explains no connection', async () => {
    fakeServer({ sharePlan: async () => ({ status: 'failed' }) })
    const { store } = await purchasedPlan()

    expect(await sharePlan(plain(store.current))).toEqual({
      status: 'problem',
      message: expect.stringContaining('connection'),
    })
  })

  it('passes on a refusal', async () => {
    fakeServer({ sharePlan: async () => ({ status: 'refused', message: 'No thanks.' }) })
    const { store } = await purchasedPlan()

    expect(await sharePlan(plain(store.current))).toEqual({
      status: 'problem',
      message: 'No thanks.',
    })
  })

  it('stops a plan too large for a cell before sending it', async () => {
    const server = fakeServer()
    const { store } = await purchasedPlan()
    const event = plain(store.current)
    const noise = Array.from({ length: 30_000 }, () => crypto.randomUUID()).join('')

    expect(await sharePlan({ ...event, name: noise })).toEqual({
      status: 'problem',
      message: expect.stringContaining('too big'),
    })
    expect(server.stored.size).toBe(0)
  })
})

describe('sharing an enormous plan', () => {
  it('explains it, rather than never finishing', async () => {
    fakeServer()
    const { store } = await purchasedPlan()

    expect(await sharePlan({ ...plain(store.current), name: 'x'.repeat(3_000_000) })).toEqual({
      status: 'problem',
      message: expect.stringContaining('too big'),
    })
  })
})

describe('share section on Review', () => {
  it('warns who can see the plan', async () => {
    fakeServer()
    const { wrapper } = await purchasedPlan()

    expect(wrapper.find('[data-share]').text()).toContain('Anyone with the link')
  })

  it('shows the link once shared', async () => {
    fakeServer()
    const { wrapper } = await purchasedPlan()
    await wrapper.find('.share-plan').trigger('click')
    await settled()

    const link = wrapper.find<HTMLInputElement>('input[name="share-link"]')
    expect(link.element.value).toBe(shareLink(SHARE_ID))
  })

  it('shows a failure and no link', async () => {
    fakeServer({ sharePlan: async () => ({ status: 'failed' }) })
    const { wrapper } = await purchasedPlan()
    await wrapper.find('.share-plan').trigger('click')
    await settled()

    expect(wrapper.find('[data-share] [role="alert"]').text()).toContain('connection')
    expect(wrapper.find('input[name="share-link"]').exists()).toBe(false)
  })

  it('copies the link', async () => {
    fakeServer()
    const writeText = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const { wrapper } = await purchasedPlan()
    await wrapper.find('.share-plan').trigger('click')
    await settled()
    await wrapper.find('.copy-link').trigger('click')
    await settled()

    expect(writeText).toHaveBeenCalledWith(shareLink(SHARE_ID))
    expect(wrapper.find('[data-share] [role="status"]').text()).toContain('copied')
  })

  it('says when copying is not allowed', async () => {
    fakeServer()
    const writeText = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const { wrapper } = await purchasedPlan()
    await wrapper.find('.share-plan').trigger('click')
    await settled()
    await wrapper.find('.copy-link').trigger('click')
    await settled()

    expect(wrapper.find('[data-share] [role="status"]').text()).toContain("couldn't")
  })

  it('offers the phone’s own sharing when there is one', async () => {
    fakeServer()
    const share = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share })
    const { wrapper } = await purchasedPlan()
    await wrapper.find('.share-plan').trigger('click')
    await settled()
    await wrapper.find('.send-link').trigger('click')

    expect(share).toHaveBeenCalledWith({ url: shareLink(SHARE_ID) })
  })

  it('stays quiet when someone closes the phone’s sharing', async () => {
    fakeServer()
    vi.stubGlobal('navigator', {
      ...navigator,
      share: vi.fn<() => Promise<void>>().mockRejectedValue(new Error('cancelled')),
    })
    const { wrapper } = await purchasedPlan()
    await wrapper.find('.share-plan').trigger('click')
    await settled()
    await wrapper.find('.send-link').trigger('click')
    await settled()

    expect(wrapper.find('[data-share] [role="alert"]').exists()).toBe(false)
  })
})

describe('opening a shared plan', () => {
  async function shared() {
    const { store } = await purchasedPlan()
    return plain(store.current)
  }

  async function open(id = SHARE_ID) {
    const mounted = await mountApp(`/shared/${id}`)
    await settled()
    return mounted
  }

  it('previews the plan without adding it', async () => {
    const event = await shared()
    await storedPlan({ ...event, name: 'Shared wedding' })
    const { wrapper } = await open()

    expect(wrapper.text()).toContain('Shared wedding')
    expect(wrapper.text()).toContain('Purchased')
    expect(useEventStore().events).toEqual([])
  })

  it('adds a copy with a new id and goes to it', async () => {
    const event = await shared()
    await storedPlan(event)
    const { wrapper, router } = await open()
    await wrapper.find('.add-shared').trigger('click')
    await settled()
    const store = useEventStore()

    expect(store.events).toHaveLength(1)
    expect(store.events[0]?.id).not.toBe(event.id)
    expect(store.events[0]?.sharedFrom).toBe(SHARE_ID)
    expect(router.currentRoute.value.path).toBe(`/events/${store.events[0]?.id}/review`)
  })

  it('keeps frozen prices intact, whatever this phone’s live prices are', async () => {
    const event = await shared()
    await storedPlan(event)
    const { wrapper } = await open()
    useCatalogueStore().prices = []
    await wrapper.find('.add-shared').trigger('click')
    await settled()
    const store = useEventStore()

    expect(store.current?.purchase).toEqual(event.purchase)
    expect(store.current?.frozenPrices).toEqual(event.frozenPrices)
    expect(store.allocation?.totals.costPence).toBe(event.purchase?.allocation.totals.costPence)
  })

  it('says when a plan is not found', async () => {
    fakeServer()
    const { wrapper } = await open()

    expect(wrapper.find('[role="alert"]').text()).toContain('could not be found')
    expect(wrapper.find('.add-shared').exists()).toBe(false)
  })

  it('offers another try with no connection', async () => {
    const event = await shared()
    const server = await storedPlan(event)
    const working = server.fetchShared
    server.fetchShared = async () => ({ status: 'failed' })
    const { wrapper } = await open()

    expect(wrapper.find('[role="alert"]').text()).toContain('connection')

    server.fetchShared = working
    await wrapper.find('.retry-shared').trigger('click')
    await settled()

    expect(wrapper.find('.add-shared').exists()).toBe(true)
  })

  it('refuses a damaged plan', async () => {
    fakeServer({ fetchShared: async () => ({ status: 'ok', payload: 'nonsense' }) })
    const { wrapper } = await open()

    expect(wrapper.find('[role="alert"]').text()).toContain('hold a plan')
  })

  it('refuses a plan with bad contents', async () => {
    const event = await shared()
    await storedPlan({ ...event, frozenPrices: [{ flowerId: 1 }] } as unknown as EventPlan)
    const { wrapper } = await open()

    expect(wrapper.find('[role="alert"]').text()).toContain('not a valid event')
    expect(wrapper.find('.add-shared').exists()).toBe(false)
  })

  it('explains a plan from a newer version of the app', async () => {
    const event = await shared()
    await storedPlan({ ...event, schemaVersion: 999 })
    const { wrapper } = await open()

    expect(wrapper.find('[role="alert"]').text()).toContain('newer version')
  })

  it('offers your copy, or another, when opened again', async () => {
    const event = await shared()
    await storedPlan(event)
    const { wrapper, router } = await open()
    await wrapper.find('.add-shared').trigger('click')
    await settled()
    const store = useEventStore()
    await router.push(`/shared/${SHARE_ID}`)
    await settled()

    expect(wrapper.find('.open-copy').attributes('href')).toContain(store.events[0]?.id)
    expect(wrapper.find('.add-shared').text()).toBe('Add another copy')

    await wrapper.find('.add-shared').trigger('click')
    await settled()

    expect(store.events).toHaveLength(2)
  })
})

describe('pasting a shared link', () => {
  it('is offered on the Events tab', async () => {
    const { wrapper } = await mountApp('/events')

    expect(wrapper.find('a[href*="/shared"]').text()).toBe('Open a shared link')
  })

  it('opens the plan from a pasted link', async () => {
    const { store } = await purchasedPlan()
    await storedPlan(plain(store.current))
    const { wrapper, router } = await mountApp('/shared')
    await wrapper.find('input[name="shared-link"]').setValue(`https://x.test/#/shared/${SHARE_ID}`)
    await wrapper.find('form').trigger('submit')
    await settled()

    expect(router.currentRoute.value.path).toBe(`/shared/${SHARE_ID}`)
    expect(wrapper.find('.add-shared').exists()).toBe(true)
  })

  it('pastes and opens a copied link in one tap', async () => {
    const { store } = await purchasedPlan()
    await storedPlan(plain(store.current))
    const readText = vi.fn<() => Promise<string>>().mockResolvedValue(shareLink(SHARE_ID))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText } })
    const { wrapper, router } = await mountApp('/shared')
    await wrapper.find('.paste-link').trigger('click')
    await settled()

    expect(router.currentRoute.value.path).toBe(`/shared/${SHARE_ID}`)
  })

  it('asks for a manual paste when the clipboard cannot be read', async () => {
    const readText = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText } })
    const { wrapper, router } = await mountApp('/shared')
    await wrapper.find('.paste-link').trigger('click')
    await settled()

    expect(router.currentRoute.value.path).toBe('/shared')
    expect(wrapper.find('[role="alert"]').text()).toContain('Paste')
  })

  it('explains text that is not a link', async () => {
    const { wrapper } = await mountApp('/shared')
    await wrapper.find('input[name="shared-link"]').setValue('hello')
    await wrapper.find('form').trigger('submit')
    await settled()

    expect(wrapper.find('[role="alert"]').text()).toContain('link')
  })
})
