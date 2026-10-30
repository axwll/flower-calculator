import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountEvent, setDesign } from './helpers'

async function weddingPlan() {
  const mounted = await mountEvent('work-plan')
  setDesign(mounted.store, 'bridal-bouquet', 1)
  setDesign(mounted.store, 'bridesmaid-bouquet', 7)
  setDesign(mounted.store, 'groom', 1)
  await flushPromises()
  return mounted
}

describe('flower matrix', () => {
  it('stays hidden until asked for', async () => {
    const { wrapper } = await weddingPlan()

    expect(wrapper.find('[data-matrix]').exists()).toBe(false)
  })

  it('has a column per design and a total', async () => {
    const { wrapper } = await weddingPlan()
    await wrapper.find('input[name="show-matrix"]').setValue(true)

    expect(wrapper.findAll('[data-matrix] thead th').map((cell) => cell.text())).toEqual([
      'Flower',
      'Bridal bouquet',
      "Bridesmaid's bouquets",
      'Groom',
      'Total',
    ])
  })

  it('shows total stems in each cell, blank where unused', async () => {
    const { wrapper } = await weddingPlan()
    await wrapper.find('input[name="show-matrix"]').setValue(true)
    const cells = wrapper
      .find('[data-matrix-flower="focus-rose"]')
      .findAll('td')
      .map((cell) => cell.text())

    expect(cells).toEqual(['5', '28', '', '33'])
  })

  it('totals match the stems for every flower', async () => {
    const { wrapper, store } = await weddingPlan()
    await wrapper.find('input[name="show-matrix"]').setValue(true)

    const used = store.allocation?.flowers.filter((flower) => flower.stems > 0) ?? []

    expect(used.length).toBeGreaterThan(0)
    for (const flower of used) {
      const row = wrapper.find(`[data-matrix-flower="${flower.flowerId}"]`)
      expect(row.findAll('td').at(-1)?.text()).toBe(String(flower.stems))
    }
  })

  it('hides again', async () => {
    const { wrapper } = await weddingPlan()
    await wrapper.find('input[name="show-matrix"]').setValue(true)
    await wrapper.find('input[name="show-matrix"]').setValue(false)

    expect(wrapper.find('[data-matrix]').exists()).toBe(false)
  })
})

describe('print controls', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { wrapper } = await weddingPlan()
    await wrapper.find('button.save-pdf').trigger('click')

    expect(print).toHaveBeenCalledOnce()
  })

  it('stays away until there is something to print', async () => {
    const { wrapper } = await mountEvent('work-plan')

    expect(wrapper.find('button.save-pdf').exists()).toBe(false)
  })

  it('sets one design per page when asked', async () => {
    const { wrapper } = await weddingPlan()
    const plan = () => wrapper.find('[data-work-plan]')

    expect(plan().classes()).not.toContain('one-per-page')

    await wrapper.find('input[name="one-per-page"]').setValue(true)

    expect(plan().classes()).toContain('one-per-page')
  })

  it('keeps the controls off the printout', async () => {
    const { wrapper } = await weddingPlan()

    expect(wrapper.find('.print-options').classes()).toContain('no-print')
  })

  it('keeps the event name out of the work plan itself', async () => {
    const { wrapper } = await weddingPlan()

    expect(wrapper.find('[data-work-plan]').text()).not.toContain('Test event')
    expect(wrapper.find('.event-header').text()).toContain('Test event')
  })
})
