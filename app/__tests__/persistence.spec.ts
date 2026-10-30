import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import { memoryRepository, setEventRepository } from '../storage/repository'
import type { EventRepository } from '../storage/repository'
import { useEventStore } from '../stores/event'
import { mountApp, setDesign } from './helpers'

/** A fresh store over the same storage, which is what reopening the app does. */
async function reopen() {
  setActivePinia(createPinia())
  const store = useEventStore()
  await store.whenReady()
  return store
}

function failingSaves(): EventRepository {
  return { loadAll: async () => [], save: () => Promise.reject(new Error('Disk full')) }
}

afterEach(() => {
  setEventRepository(null)
})

describe('saving and loading', () => {
  it('brings events back after reopening', async () => {
    setEventRepository(memoryRepository())
    const store = await reopen()
    store.createEvent({ name: 'June wedding', targetBudgetPence: 50000 })
    await flushPromises()

    const reopened = await reopen()

    expect(reopened.events).toHaveLength(1)
    expect(reopened.events[0]).toMatchObject({ name: 'June wedding', targetBudgetPence: 50000 })
  })

  it('saves every edit', async () => {
    setEventRepository(memoryRepository())
    const store = await reopen()
    store.open(store.createEvent({ name: 'A' }))
    setDesign(store, 'pedestal', 3)
    store.togglePalette('focal', 'focus-rose')
    await flushPromises()

    const reopened = await reopen()
    reopened.open(reopened.events[0]?.id ?? '')

    expect(reopened.current?.designs.find((item) => item.designId === 'pedestal')?.quantity).toBe(3)
    expect(reopened.current?.palette.focal).toEqual(['focus-rose'])
  })

  it('allocates a reopened event the same way', async () => {
    setEventRepository(memoryRepository())
    const store = await reopen()
    store.open(store.createEvent({ name: 'A' }))
    setDesign(store, 'bridal-bouquet', 1)
    await flushPromises()
    const before = store.allocation?.totals

    const reopened = await reopen()
    reopened.open(reopened.events[0]?.id ?? '')

    expect(reopened.allocation?.totals).toEqual(before)
  })

  it('opens an event straight from its address after a reload', async () => {
    setEventRepository(memoryRepository())
    const store = await reopen()
    const id = store.createEvent({ name: 'June wedding' })
    await flushPromises()

    const { wrapper, router } = await mountApp(`/events/${id}/palette`)

    expect(router.currentRoute.value.path).toBe(`/events/${id}/palette`)
    expect(wrapper.find('h1').text()).toBe('June wedding')
  })

  it('still sends an unknown address back to Events', async () => {
    setEventRepository(memoryRepository())
    const { router } = await mountApp('/events/ghost/palette')

    expect(router.currentRoute.value.path).toBe('/events')
  })

  it('does not lose an event made while loading', async () => {
    setEventRepository(memoryRepository())
    const first = await reopen()
    first.createEvent({ name: 'Saved' })
    await flushPromises()

    setActivePinia(createPinia())
    const store = useEventStore()
    store.createEvent({ name: 'New' })
    await store.whenReady()

    expect(store.events.map((event) => event.name).sort()).toEqual(['New', 'Saved'])
  })
})

describe('storage problems', () => {
  it('says when a change could not be saved', async () => {
    setEventRepository(failingSaves())
    const { wrapper } = await mountApp()
    useEventStore().createEvent({ name: 'A' })
    await flushPromises()

    expect(wrapper.find('[data-storage-problem]').text()).toContain("aren't being saved")
  })

  it('clears the message once saving works again', async () => {
    const repository = memoryRepository()
    let failing = true
    setEventRepository({
      loadAll: repository.loadAll,
      save: (event) => (failing ? Promise.reject(new Error('No')) : repository.save(event)),
    })
    const { wrapper } = await mountApp()
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A' }))
    await flushPromises()
    failing = false
    setDesign(store, 'groom', 1)
    await flushPromises()

    expect(wrapper.find('[data-storage-problem]').exists()).toBe(false)
  })

  it('says when events could not be loaded', async () => {
    setEventRepository({
      loadAll: () => Promise.reject(new Error('Blocked')),
      save: async () => undefined,
    })
    const { wrapper } = await mountApp()

    expect(wrapper.find('[data-storage-problem]').text()).toContain("couldn't be loaded")
  })

  it('skips an unreadable event, counts it and keeps it stored', async () => {
    const repository = memoryRepository([{ id: 'broken' }])
    setEventRepository(repository)
    const { wrapper } = await mountApp()

    expect(wrapper.find('[data-storage-problem]').text()).toContain("1 event couldn't be opened")
    expect(useEventStore().events).toEqual([])
    expect(await repository.loadAll()).toEqual([{ id: 'broken' }])
  })

  it('shows nothing when storage is fine', async () => {
    setEventRepository(memoryRepository())
    const { wrapper } = await mountApp()

    expect(wrapper.find('[data-storage-problem]').exists()).toBe(false)
  })
})

describe('memoryRepository', () => {
  it('keeps its own copy of what it saves', async () => {
    const repository = memoryRepository()
    const event = { id: 'a', name: 'First' }
    await repository.save(event as never)
    event.name = 'Changed'

    expect(await repository.loadAll()).toEqual([{ id: 'a', name: 'First' }])
  })

  it('replaces an event with the same id', async () => {
    const repository = memoryRepository()
    await repository.save({ id: 'a', name: 'First' } as never)
    await repository.save({ id: 'a', name: 'Second' } as never)

    expect(await repository.loadAll()).toEqual([{ id: 'a', name: 'Second' }])
  })
})
