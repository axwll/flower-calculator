import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import { memoryRepository, setEventRepository } from '../storage/repository'
import { useEventStore } from '../stores/event'
import { mountEvent, setDesign } from './helpers'

async function reopen() {
  setActivePinia(createPinia())
  const store = useEventStore()
  await store.whenReady()
  return store
}

afterEach(() => {
  setEventRepository(null)
})

describe('deleteEvent', () => {
  it('removes the event from the list and from storage', async () => {
    setEventRepository(memoryRepository())
    const { store } = await mountEvent()
    const id = store.current?.id ?? ''
    const other = store.createEvent({ name: 'Other' })
    await flushPromises()

    expect(await store.deleteEvent(id)).toBe(true)

    expect(store.events.map((event) => event.id)).toEqual([other])
    const reopened = await reopen()
    expect(reopened.events.map((event) => event.id)).toEqual([other])
  })

  it('closes the event if it was open', async () => {
    const { store } = await mountEvent()

    await store.deleteEvent(store.current?.id ?? '')

    expect(store.current).toBeNull()
  })

  it('leaves another open event open', async () => {
    const { store } = await mountEvent()
    const open = store.current?.id
    const other = store.createEvent({ name: 'Other' })

    await store.deleteEvent(other)

    expect(store.current?.id).toBe(open)
  })

  it('keeps the event if storage refuses', async () => {
    const repository = memoryRepository()
    setEventRepository({
      ...repository,
      remove: () => Promise.reject(new Error('Blocked')),
    })
    const { store } = await mountEvent()
    const id = store.current?.id ?? ''

    expect(await store.deleteEvent(id)).toBe(false)

    expect(store.current?.id).toBe(id)
    expect(store.events).toHaveLength(1)
  })

  it('says no to an unknown id', async () => {
    const { store } = await mountEvent()

    expect(await store.deleteEvent('not-an-event')).toBe(false)
    expect(store.events).toHaveLength(1)
  })
})

describe('delete on the Review tab', () => {
  it('asks first, and "Keep it" changes nothing', async () => {
    const { wrapper, store } = await mountEvent('review')

    await wrapper.find('.delete-event').trigger('click')
    expect(wrapper.find('[data-delete-confirm]').text()).toContain('Test event')
    expect(store.events).toHaveLength(1)

    await wrapper.find('.keep-event').trigger('click')
    expect(wrapper.find('[data-delete-confirm]').exists()).toBe(false)
    expect(store.events).toHaveLength(1)
  })

  it('deletes after confirming and goes back to Events', async () => {
    const { wrapper, router, store } = await mountEvent('review')

    await wrapper.find('.delete-event').trigger('click')
    await wrapper.find('.confirm-delete').trigger('click')
    await flushPromises()

    expect(store.events).toEqual([])
    expect(router.currentRoute.value.path).toBe('/events')
    expect(wrapper.text()).toContain('No events yet.')
  })

  it('warns that a purchase goes with it', async () => {
    const { wrapper, store } = await mountEvent('review')
    setDesign(store, 'pedestal', 2)
    store.togglePalette('focal', 'focus-rose')
    store.markPurchased()
    await flushPromises()

    await wrapper.find('.delete-event').trigger('click')

    expect(wrapper.find('[data-delete-confirm]').text()).toContain('purchase record')
  })

  it('explains a failure and stays on the event', async () => {
    const repository = memoryRepository()
    setEventRepository({
      ...repository,
      remove: () => Promise.reject(new Error('Blocked')),
    })
    const { wrapper, router, store } = await mountEvent('review')
    const path = router.currentRoute.value.path

    await wrapper.find('.delete-event').trigger('click')
    await wrapper.find('.confirm-delete').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-delete] [role="alert"]').text()).toContain("couldn't be deleted")
    expect(router.currentRoute.value.path).toBe(path)
    expect(store.events).toHaveLength(1)
  })

  it('leaves a deleted event out of "Start from"', async () => {
    const { store, router, wrapper } = await mountEvent('review')
    await store.deleteEvent(store.current?.id ?? '')
    await router.push('/events/new')
    await flushPromises()

    expect(wrapper.find('select[name="copy-from"]').exists()).toBe(false)
  })

  it('sends an old link for a deleted event back to Events', async () => {
    const { store, router } = await mountEvent()
    const id = store.current?.id ?? ''
    await store.deleteEvent(id)
    await router.push('/events')

    await router.push(`/events/${id}/review`)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/events')
  })
})

describe('memoryRepository', () => {
  it('forgets a removed event', async () => {
    const repository = memoryRepository([{ id: 'a' }, { id: 'b' }])

    await repository.remove('a')

    expect(await repository.loadAll()).toEqual([{ id: 'b' }])
  })
})
