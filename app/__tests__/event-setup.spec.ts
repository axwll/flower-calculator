import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { useEventStore } from '../stores/event'
import { mountApp } from './helpers'

async function fillIn(
  wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper'],
  name: string,
  budget = '',
) {
  await wrapper.find('input[name="name"]').setValue(name)
  await wrapper.find('input[name="budget"]').setValue(budget)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('events list', () => {
  it('says when there are no events', async () => {
    const { wrapper } = await mountApp('/events')

    expect(wrapper.text()).toContain('No events yet')
  })

  it('leads to a new event', async () => {
    const { wrapper, router } = await mountApp('/events')
    await wrapper.find('a[href="/events/new"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/events/new')
  })

  it('lists events once made', async () => {
    const { wrapper, router } = await mountApp('/events/new')
    await fillIn(wrapper, 'June wedding')
    await router.push('/events')
    await flushPromises()

    expect(wrapper.text()).toContain('June wedding')
    expect(wrapper.text()).not.toContain('No events yet')
  })
})

describe('event setup', () => {
  it('moves on to the designs step', async () => {
    const { wrapper, router } = await mountApp('/events/new')
    await fillIn(wrapper, 'June wedding')

    expect(router.currentRoute.value.path).toMatch(/^\/events\/[^/]+\/designs$/)
  })

  it('refuses an empty name', async () => {
    const { wrapper, router } = await mountApp('/events/new')
    await fillIn(wrapper, '   ')

    expect(wrapper.text()).toContain('Give the event a name')
    expect(router.currentRoute.value.path).toBe('/events/new')
    expect(useEventStore().events).toEqual([])
  })

  it('refuses a budget that is not an amount', async () => {
    const { wrapper, router } = await mountApp('/events/new')
    await fillIn(wrapper, 'June wedding', 'lots')

    expect(wrapper.text()).toContain('Enter the budget in pounds')
    expect(router.currentRoute.value.path).toBe('/events/new')
  })

  it('stores a budget in pence', async () => {
    const { wrapper } = await mountApp('/events/new')
    await fillIn(wrapper, 'June wedding', '£1,250.50')

    expect(useEventStore().events[0]?.targetBudgetPence).toBe(125050)
  })

  it('leaves the budget unset when it is blank', async () => {
    const { wrapper } = await mountApp('/events/new')
    await fillIn(wrapper, 'June wedding')

    expect(useEventStore().events[0]?.targetBudgetPence).toBeUndefined()
  })

  it('labels every field', async () => {
    const { wrapper } = await mountApp('/events/new')

    expect(wrapper.findAll('form input').every((input) => input.element.closest('label'))).toBe(
      true,
    )
  })
})

describe('event pages', () => {
  it('sends an event that no longer exists back to Events', async () => {
    const { router } = await mountApp('/events/ghost/designs')

    expect(router.currentRoute.value.path).toBe('/events')
  })
})
