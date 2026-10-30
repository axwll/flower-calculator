import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '../pricing'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { thresholdProblem, useThresholdsStore } from '../stores/thresholds'
import { mountApp, mountEvent } from './helpers'

const DAY = 86_400_000

async function fill(wrapper: VueWrapper, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    await wrapper.find(`input[name="${name}"]`).setValue(value)
  }
  await wrapper.find('form.thresholds').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('thresholdProblem', () => {
  it('accepts the defaults', () => {
    expect(thresholdProblem(DEFAULT_SETTINGS)).toBeNull()
  })

  it.each([
    ['thin bunch above 100', { thinBunchPercent: 101 }],
    ['thin bunch below 0', { thinBunchPercent: -1 }],
    ['part of a day', { priceAmberDays: 1.5 }],
    ['amber at zero', { priceAmberDays: 0 }],
    ['red equal to amber', { priceRedDays: 14 }],
    ['red before amber', { priceRedDays: 10 }],
    ['big change at zero', { bigChangePercent: 0 }],
    ['not a number', { bigChangePercent: Number.NaN }],
  ])('refuses %s', (_name, change) => {
    expect(thresholdProblem({ ...DEFAULT_SETTINGS, ...change })).not.toBeNull()
  })
})

describe('thresholds in Settings', () => {
  it('starts with the section 5 defaults', async () => {
    await mountApp('/settings')

    expect(useThresholdsStore().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('saves, and lasts across launches', async () => {
    const { wrapper } = await mountApp('/settings')
    await fill(wrapper, { 'thin-bunch': '20', 'price-amber': '7', 'price-red': '21' })
    await mountApp('/settings')

    expect(useThresholdsStore().settings).toEqual({
      thinBunchPercent: 20,
      priceAmberDays: 7,
      priceRedDays: 21,
      bigChangePercent: 50,
    })
  })

  it('refuses bad values and keeps the old ones', async () => {
    const { wrapper } = await mountApp('/settings')
    await fill(wrapper, { 'price-red': '3' })

    expect(wrapper.find('.thresholds [role="alert"]').exists()).toBe(true)
    expect(useThresholdsStore().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('refuses a blank box', async () => {
    const { wrapper } = await mountApp('/settings')
    await fill(wrapper, { 'big-change': ' ' })

    expect(useThresholdsStore().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('goes back to the defaults', async () => {
    const { wrapper } = await mountApp('/settings')
    await fill(wrapper, { 'thin-bunch': '20' })
    await wrapper.find('.reset-thresholds').trigger('click')

    expect(useThresholdsStore().settings).toEqual(DEFAULT_SETTINGS)
    expect((wrapper.find('input[name="thin-bunch"]').element as HTMLInputElement).value).toBe('15')
  })

  it('ignores a damaged saved value', async () => {
    localStorage.setItem('thresholds', '{oops')
    await mountApp('/settings')

    expect(useThresholdsStore().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('ignores saved values that fail the rules', async () => {
    localStorage.setItem('thresholds', JSON.stringify({ priceRedDays: 1 }))
    await mountApp('/settings')

    expect(useThresholdsStore().settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe('using thresholds', () => {
  it('copies them into new events only', async () => {
    const { store } = await mountEvent()
    const first = store.current!.id
    useThresholdsStore().save({ ...DEFAULT_SETTINGS, thinBunchPercent: 40 })
    const second = store.createEvent({ name: 'New' })
    const events = useEventStore().events

    expect(events.find(({ id }) => id === first)?.settings.thinBunchPercent).toBe(15)
    expect(events.find(({ id }) => id === second)?.settings.thinBunchPercent).toBe(40)
  })

  it('colours price ages by the saved days, at the boundary', async () => {
    localStorage.setItem(
      'thresholds',
      JSON.stringify({ ...DEFAULT_SETTINGS, priceAmberDays: 3, priceRedDays: 5 }),
    )
    const { wrapper } = await mountApp('/prices')
    const ageAll = async (days: number) => {
      const catalogue = useCatalogueStore()
      const reportedAt = new Date(Date.now() - days * DAY - 60_000).toISOString()
      catalogue.prices = catalogue.prices.map((price) => ({ ...price, reportedAt }))
      await flushPromises()
      return wrapper.find('[data-price-flower="focus-rose"] .price-age').classes()
    }

    expect(await ageAll(2)).toContain('age-fresh')
    expect(await ageAll(3)).toContain('age-amber')
    expect(await ageAll(5)).toContain('age-red')
  })

  it('asks about a big change using the saved percent', async () => {
    localStorage.setItem(
      'thresholds',
      JSON.stringify({ ...DEFAULT_SETTINGS, bigChangePercent: 10 }),
    )
    localStorage.setItem('nickname', 'Sam')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper } = await mountApp('/prices/focus-rose')
    await wrapper.find('input[name="price"]').setValue('50.00')
    await wrapper.find('form').trigger('submit')

    expect(confirm).toHaveBeenCalled()
  })
})
