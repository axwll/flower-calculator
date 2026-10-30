import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { mountApp, mountEvent } from './helpers'

describe('App shell', () => {
  it('shows the four tabs', async () => {
    const { wrapper } = await mountApp()

    expect(wrapper.findAll('nav.tabs a').map((tab) => tab.text())).toEqual([
      'Events',
      'Prices',
      'Library',
      'Settings',
    ])
  })

  it('starts on Events', async () => {
    const { router } = await mountApp()

    expect(router.currentRoute.value.path).toBe('/events')
  })

  it.each([
    ['Library', '/library'],
    ['Settings', '/settings'],
  ])('opens %s, which says it is coming later', async (label, path) => {
    const { wrapper, router } = await mountApp()
    await router.push(path)
    await flushPromises()

    expect(wrapper.find('h1').text()).toBe(label)
    expect(wrapper.text()).toContain('Coming later')
  })

  it('marks the current tab', async () => {
    const { wrapper, router } = await mountApp()
    await router.push('/prices')
    await flushPromises()

    expect(wrapper.find('nav.tabs a[aria-current="page"]').text()).toBe('Prices')
  })

  it('keeps Events marked while inside an event', async () => {
    const { wrapper } = await mountEvent('palette')

    expect(wrapper.find('nav.tabs a[aria-current="page"]').text()).toBe('Events')
    expect(wrapper.find('nav.tabs a.tab-active').text()).toBe('Events')
  })

  it('goes back to the previous screen', async () => {
    const { router } = await mountApp()
    await router.push('/prices')
    await router.push('/library')
    router.back()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/prices')
  })

  it('sends an unknown address to Events', async () => {
    const { router } = await mountApp('/nowhere')

    expect(router.currentRoute.value.path).toBe('/events')
  })
})
