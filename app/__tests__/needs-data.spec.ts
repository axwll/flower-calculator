import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { useCatalogueStore } from '../stores/catalogue'
import { mountEvent } from './helpers'

function badge(wrapper: VueWrapper, role: string, flowerId: string) {
  return wrapper.find(`[data-role="${role}"] [data-flower="${flowerId}"] [data-needs-data]`)
}

async function paletteWithFiller() {
  const mounted = await mountEvent('palette')
  const { store } = mounted
  const pumpkin = store.current?.designs.findIndex((item) => item.designId === 'pumpkin') ?? -1
  store.setEnabled(pumpkin, true)
  store.setQuantity(pumpkin, 1)
  await flushPromises()
  return mounted
}

describe('needs data', () => {
  it('badges a flower with no price', async () => {
    const { wrapper } = await paletteWithFiller()

    expect(badge(wrapper, 'filler', 'scabious').text()).toBe('Needs data')
  })

  it('leaves the badge off a priced flower', async () => {
    const { wrapper } = await paletteWithFiller()

    expect(badge(wrapper, 'filler', 'santini').exists()).toBe(false)
  })

  it('leaves the badge off a foraged flower', async () => {
    const { wrapper } = await paletteWithFiller()
    const catalogue = useCatalogueStore()
    catalogue.flowers = catalogue.flowers.map((flower) =>
      flower.id === 'scabious' ? { ...flower, soldAs: 'foraged' } : flower,
    )
    await flushPromises()

    expect(badge(wrapper, 'filler', 'scabious').exists()).toBe(false)
  })

  it('can still be ticked, with stems counted and cost left out', async () => {
    const { wrapper, store } = await paletteWithFiller()
    await wrapper
      .find('[data-role="filler"] [data-flower="scabious"] input[name="tick"]')
      .setValue(true)

    expect(store.allocation?.totals).toMatchObject({
      stems: 20,
      costPence: 0,
      needsDataFlowers: 1,
    })
    expect(wrapper.find('[aria-label="Event summary"]').text()).toContain('1 flower not costed')
  })

  it('lists not-costed flowers on the review', async () => {
    const { wrapper, router, store } = await paletteWithFiller()
    store.togglePalette('filler', 'scabious')
    await router.push(`/events/${store.current?.id}/review`)
    await flushPromises()
    const list = wrapper.find('[data-not-costed]')

    expect(list.text()).toContain('Scabious / paw paw')
    expect(list.text()).toContain('20 stems')
    expect(list.text()).toContain('Needs data')
  })

  it('hides that list when everything is costed', async () => {
    const { wrapper } = await mountEvent('review')

    expect(wrapper.find('[data-not-costed]').exists()).toBe(false)
  })
})
