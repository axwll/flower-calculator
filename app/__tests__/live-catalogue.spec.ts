import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MasterData } from '@engine'

import { setApiClient } from '../api/client'
import type { ApiClient, MasterReply } from '../api/client'
import { seed } from '../seed/seed'
import { memoryPriceStorage, setPriceStorage } from '../storage/priceStorage'
import { useCatalogueStore } from '../stores/catalogue'
import { mountApp } from './helpers'

function master(overrides: Partial<MasterData> = {}): MasterData {
  return {
    version: 5,
    flowers: [{ ...(seed.flowers[0] as MasterData['flowers'][0]), name: 'From the Sheet' }],
    suppliers: seed.suppliers,
    designs: seed.designs,
    recipes: seed.recipes,
    prices: [],
    ...overrides,
  }
}

function fakeClient(result: MasterReply): ApiClient & { fetchMaster: ReturnType<typeof vi.fn> } {
  return {
    fetchMaster: vi.fn<ApiClient['fetchMaster']>().mockResolvedValue(result),
    send: async () => ({ status: 'sent' }),
  }
}

function freshStore() {
  setActivePinia(createPinia())
  return useCatalogueStore()
}

describe('catalogue: loading live data', () => {
  beforeEach(() => {
    setPriceStorage(memoryPriceStorage())
  })

  afterEach(() => {
    setApiClient(null)
    setPriceStorage(null)
  })

  it('shows the seed on a first run with no connection, and says so', async () => {
    setApiClient(fakeClient({ status: 'failed' }))
    const store = freshStore()
    await store.start()

    expect(store.flowers).toEqual(seed.flowers)
    expect(store.source).toBe('seed')
  })

  it('switches to live data', async () => {
    setApiClient(fakeClient({ status: 'ok', data: master() }))
    const store = freshStore()
    await store.start()

    expect(store.flowers[0]?.name).toBe('From the Sheet')
    expect(store.source).toBe('live')
  })

  it('caches live data for next time', async () => {
    setApiClient(fakeClient({ status: 'ok', data: master() }))
    await freshStore().start()

    setApiClient(fakeClient({ status: 'failed' }))
    const store = freshStore()
    await store.start()

    expect(store.flowers[0]?.name).toBe('From the Sheet')
    expect(store.source).toBe('cache')
  })

  it('asks for changes since the cached version', async () => {
    setApiClient(fakeClient({ status: 'ok', data: master() }))
    await freshStore().start()

    const client = fakeClient({ status: 'unchanged' })
    setApiClient(client)
    const store = freshStore()
    await store.start()

    expect(client.fetchMaster).toHaveBeenCalledWith(5)
    expect(store.flowers[0]?.name).toBe('From the Sheet')
    expect(store.source).toBe('live')
  })

  it('does not send a version with no cache', async () => {
    const client = fakeClient({ status: 'failed' })
    setApiClient(client)
    await freshStore().start()

    expect(client.fetchMaster).toHaveBeenCalledWith(undefined)
  })

  it('keeps cached data when a refresh fails', async () => {
    setApiClient(fakeClient({ status: 'ok', data: master() }))
    const store = freshStore()
    await store.start()

    setApiClient(fakeClient({ status: 'failed' }))
    await store.refresh()

    expect(store.flowers[0]?.name).toBe('From the Sheet')
  })

  it('copes with broken cached storage', async () => {
    setPriceStorage({
      ...memoryPriceStorage(),
      loadMaster: () => Promise.reject(new Error('Blocked')),
    })
    setApiClient(fakeClient({ status: 'failed' }))
    const store = freshStore()
    await store.start()

    expect(store.source).toBe('seed')
  })

  it('still shows live data if saving the cache fails', async () => {
    setPriceStorage({
      ...memoryPriceStorage(),
      saveMaster: () => Promise.reject(new Error('Full')),
    })
    setApiClient(fakeClient({ status: 'ok', data: master() }))
    const store = freshStore()
    await store.start()

    expect(store.source).toBe('live')
  })

  it('leaves out inactive suppliers from live prices', async () => {
    const price = { ...(seed.prices[0] as MasterData['prices'][0]), supplierId: 'wholesaler-a' }
    const suppliers = seed.suppliers.map((supplier) => ({
      ...supplier,
      active: supplier.id !== 'wholesaler-a',
    }))
    setApiClient(fakeClient({ status: 'ok', data: master({ suppliers, prices: [price] }) }))
    const store = freshStore()
    await store.start()

    expect(store.activePrices).toEqual([])
  })

  it('starts when the app opens', async () => {
    const client = fakeClient({ status: 'ok', data: master() })
    setApiClient(client)
    await mountApp()
    await flushPromises()

    expect(client.fetchMaster).toHaveBeenCalled()
    expect(useCatalogueStore().source).toBe('live')
  })
})
