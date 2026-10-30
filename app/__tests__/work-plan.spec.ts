import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { mountEvent, setDesign } from './helpers'

function card(wrapper: VueWrapper, designId: string) {
  return wrapper.find(`[data-work-card="${designId}"]`)
}

function row(wrapper: VueWrapper, designId: string, flowerId: string) {
  return card(wrapper, designId).find(`[data-work-flower="${flowerId}"]`)
}

describe('work plan step', () => {
  it('is the fourth step', async () => {
    const { wrapper } = await mountEvent('work-plan')

    expect(wrapper.findAll('.steps a').map((step) => step.text())).toEqual([
      'Designs',
      'Palette',
      'Review',
      'Work plan',
    ])
  })

  it('says when there is nothing to show', async () => {
    const { wrapper } = await mountEvent('work-plan')

    expect(wrapper.text()).toContain('Add some designs first')
    expect(wrapper.findAll('[data-work-card]')).toHaveLength(0)
  })

  it('shows only enabled designs with placements', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'groom', 1)
    setDesign(store, 'pumpkin', 2)
    const pumpkin = store.current?.designs.findIndex((item) => item.designId === 'pumpkin') ?? -1
    store.setEnabled(pumpkin, false)
    await flushPromises()

    expect(
      wrapper.findAll('[data-work-card]').map((item) => item.attributes('data-work-card')),
    ).toEqual(['groom'])
  })

  it('shows quantity, and size where a design has sizes', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'pedestal', 2)
    setDesign(store, 'groom', 1)
    await flushPromises()

    expect(card(wrapper, 'pedestal').text()).toContain('Medium × 2')
    expect(card(wrapper, 'groom').text()).toContain('× 1')
    expect(card(wrapper, 'groom').text()).not.toContain('Fixed')
  })

  it('words each flower per placement', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'bridesmaid-bouquet', 7)
    setDesign(store, 'top-table', 1)
    await flushPromises()

    expect(row(wrapper, 'bridesmaid-bouquet', 'focus-rose').text()).toContain('Focus rose (white)')
    expect(row(wrapper, 'bridesmaid-bouquet', 'focus-rose').text()).toContain('4 each')
    expect(row(wrapper, 'top-table', 'hydrangea').text()).toContain('5')
  })

  it('tells helpers to number the placements', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'bridesmaid-bouquet', 7)
    setDesign(store, 'groom', 1)
    await flushPromises()

    expect(card(wrapper, 'bridesmaid-bouquet').text()).toContain('Number them 1 to 7')
    expect(card(wrapper, 'groom').text()).not.toContain('Number them')
  })

  it('shows a flower on two lines once', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'top-table', 1)
    store.togglePalette('focal', 'hydrangea')
    await flushPromises()

    expect(card(wrapper, 'top-table').findAll('[data-work-flower="hydrangea"]')).toHaveLength(1)
    expect(row(wrapper, 'top-table', 'hydrangea').text()).toContain('12')
  })

  it('warns about unassigned stems on the card', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'top-table', 1)
    await flushPromises()

    expect(card(wrapper, 'top-table').text()).toContain('30 stems have no flower chosen')
  })

  it('still lists needs-data flowers', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'groom', 1)
    await flushPromises()

    expect(row(wrapper, 'groom', 'scabious').text()).toContain('1')
  })

  it('never shows money or suppliers', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'bridal-bouquet', 1)
    setDesign(store, 'table-vases', 11)
    await flushPromises()
    const text = wrapper.find('[data-work-plan]').text()

    expect(text).not.toContain('£')
    expect(text).not.toContain('Wholesaler')
  })
})

describe('placement grid', () => {
  async function pumpkins() {
    const mounted = await mountEvent('work-plan')
    setDesign(mounted.store, 'pumpkin', 3)
    for (const id of ['alstroemeria', 'burgundy-carnation', 'santini']) {
      mounted.store.togglePalette('filler', id)
    }
    await flushPromises()
    return mounted
  }

  it('shows a column per placement when placements differ', async () => {
    const { wrapper } = await pumpkins()
    const grid = card(wrapper, 'pumpkin').find('table')

    expect(grid.findAll('thead th').map((cell) => cell.text())).toEqual(['Flower', '1', '2', '3'])
    expect(
      grid
        .find('[data-grid-flower="alstroemeria"]')
        .findAll('td')
        .map((cell) => cell.text()),
    ).toEqual(['7', '7', '6'])
  })

  it('is not needed when every placement is the same', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'bridesmaid-bouquet', 7)
    await flushPromises()

    expect(card(wrapper, 'bridesmaid-bouquet').find('table').exists()).toBe(false)
  })

  it('is not needed for a single placement', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'groom', 1)
    await flushPromises()

    expect(card(wrapper, 'groom').find('table').exists()).toBe(false)
  })

  it('stays off for designs too wide to print', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'pumpkin', 13)
    store.togglePalette('filler', 'alstroemeria')
    store.togglePalette('filler', 'santini')
    store.togglePalette('filler', 'burgundy-carnation')
    await flushPromises()

    expect(card(wrapper, 'pumpkin').find('table').exists()).toBe(false)
  })
})

describe('leftovers card', () => {
  it('lists spare stems for information', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'bridal-bouquet', 1)
    setDesign(store, 'table-vases', 4)
    await flushPromises()
    const pool = wrapper.find('[data-pool-card]')

    expect(pool.text()).toContain('Table vases')
    expect(pool.text()).toContain('Focus rose (white): 43 spare stems')
  })

  it('is absent without a pool', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'bridal-bouquet', 1)
    await flushPromises()

    expect(wrapper.find('[data-pool-card]').exists()).toBe(false)
  })
})
