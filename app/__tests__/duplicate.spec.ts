import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { useEventStore } from '../stores/event'
import { mountApp, setDesign } from './helpers'

function storeWithEvent() {
  const store = useEventStore()
  store.open(store.createEvent({ name: 'Original', date: '2026-07-04', targetBudgetPence: 50000 }))
  setDesign(store, 'pedestal', 3)
  store.togglePalette('focal', 'focus-rose')
  store.setSupplier('focus-rose', 'wholesaler-b')
  return store
}

describe('duplicateEvent', () => {
  it('copies designs, palette and supplier choices', async () => {
    await mountApp()
    const store = storeWithEvent()
    const original = store.current
    store.open(store.duplicateEvent(original?.id ?? '', { name: 'Copy' }) ?? '')

    expect(store.current?.designs).toEqual(original?.designs)
    expect(store.current?.palette).toEqual(original?.palette)
    expect(store.current?.supplierChoice).toEqual(original?.supplierChoice)
  })

  it('takes a new id and the new details', async () => {
    await mountApp()
    const store = storeWithEvent()
    const original = store.current
    store.open(store.duplicateEvent(original?.id ?? '', { name: 'Copy' }) ?? '')

    expect(store.current?.id).not.toBe(original?.id)
    expect(store.current?.name).toBe('Copy')
    expect(store.current?.date).toBeUndefined()
    expect(store.current?.targetBudgetPence).toBeUndefined()
  })

  it('leaves the original alone when the copy is edited', async () => {
    await mountApp()
    const store = storeWithEvent()
    const originalId = store.current?.id ?? ''
    store.open(store.duplicateEvent(originalId, { name: 'Copy' }) ?? '')
    setDesign(store, 'pedestal', 9)
    store.togglePalette('focal', 'hydrangea')

    const original = store.events.find((event) => event.id === originalId)
    expect(original?.designs.find((item) => item.designId === 'pedestal')?.quantity).toBe(3)
    expect(original?.palette.focal).toEqual(['focus-rose'])
  })

  it('returns nothing for an unknown event', async () => {
    await mountApp()

    expect(useEventStore().duplicateEvent('ghost', { name: 'Copy' })).toBeNull()
  })
})

describe('new event screen', () => {
  it('starts blank when there is nothing to copy', async () => {
    const { wrapper } = await mountApp('/events/new')

    expect(wrapper.find('select[name="copy-from"]').exists()).toBe(false)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Start blank')
  })

  it('offers existing events to copy', async () => {
    const { wrapper } = await mountApp('/events/new')
    storeWithEvent()
    await flushPromises()

    expect(wrapper.findAll('select[name="copy-from"] option').map((item) => item.text())).toEqual([
      'Start blank',
      'Original',
    ])
  })

  it('makes a copy with the details entered', async () => {
    const { wrapper, router } = await mountApp('/events/new')
    const store = storeWithEvent()
    await flushPromises()
    await wrapper.find('select[name="copy-from"]').setValue(store.current?.id)

    expect(wrapper.find('button[type="submit"]').text()).toBe('Duplicate event')

    await wrapper.find('input[name="name"]').setValue('August wedding')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(store.events).toHaveLength(2)
    expect(store.current?.name).toBe('August wedding')
    expect(store.current?.palette.focal).toEqual(['focus-rose'])
    expect(router.currentRoute.value.path).toContain(`/events/${store.current?.id}/designs`)
  })
})
