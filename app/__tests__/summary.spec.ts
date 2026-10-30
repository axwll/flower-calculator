import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { mountEvent } from './helpers'

function indexOf(store: Awaited<ReturnType<typeof mountEvent>>['store'], designId: string) {
  return store.current?.designs.findIndex((item) => item.designId === designId) ?? -1
}

describe('summary bar', () => {
  it('shows on the designs and palette steps only', async () => {
    const { wrapper, router, store } = await mountEvent('designs')
    const id = store.current?.id

    expect(wrapper.find('[aria-label="Event summary"]').exists()).toBe(true)

    await router.push(`/events/${id}/palette`)
    await flushPromises()
    expect(wrapper.find('[aria-label="Event summary"]').exists()).toBe(true)

    await router.push(`/events/${id}/review`)
    await flushPromises()
    expect(wrapper.find('[aria-label="Event summary"]').exists()).toBe(false)
  })

  it('starts at zero', async () => {
    const { wrapper } = await mountEvent()
    const bar = wrapper.find('[aria-label="Event summary"]').text()

    expect(bar).toContain('£0.00')
    expect(bar).toContain('0 stems')
    expect(bar).toContain('0 spare stems')
  })

  it('updates when a quantity changes', async () => {
    const { wrapper, store } = await mountEvent()
    store.setQuantity(indexOf(store, 'buttonhole'), 4)
    await flushPromises()
    const bar = wrapper.find('[aria-label="Event summary"]').text()

    expect(bar).toContain('20 stems')
    expect(bar).toContain(`${store.allocation?.totals.spareStems} spare stems`)
  })

  it('updates when a palette flower is ticked', async () => {
    const { wrapper, store } = await mountEvent()
    store.setQuantity(indexOf(store, 'pumpkin'), 1)
    store.setEnabled(indexOf(store, 'pumpkin'), true)
    store.togglePalette('filler', 'alstroemeria')
    await flushPromises()
    const bar = wrapper.find('[aria-label="Event summary"]').text()

    expect(bar).toContain('£12.00')
    expect(bar).toContain('20 stems')
    expect(bar).toContain('0 spare stems')
  })

  it('marks a cost that leaves out needs-data flowers', async () => {
    const { wrapper, store } = await mountEvent()
    store.setQuantity(indexOf(store, 'groom'), 1)
    await flushPromises()

    expect(wrapper.find('[aria-label="Event summary"]').text()).toContain('2 flowers not costed')
  })

  it('does not mention needs data when every flower is costed', async () => {
    const { wrapper } = await mountEvent()

    expect(wrapper.find('[aria-label="Event summary"]').text()).not.toContain('not costed')
  })
})
