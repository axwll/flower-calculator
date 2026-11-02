import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCatalogueStore } from '../stores/catalogue'
import { mountEvent } from './helpers'

type Store = Awaited<ReturnType<typeof mountEvent>>['store']

function cards(wrapper: VueWrapper) {
  return wrapper.findAll('[data-design="pedestal"]')
}

function pedestals(store: Store) {
  return store.current?.designs.filter(({ designId }) => designId === 'pedestal') ?? []
}

function indexOf(store: Store, size: string) {
  return (
    store.current?.designs.findIndex(
      (design) => design.designId === 'pedestal' && design.size === size,
    ) ?? -1
  )
}

async function twoSizes() {
  const mounted = await mountEvent()
  await mounted.wrapper.find('[data-design="pedestal"] .add-size').trigger('click')
  await flushPromises()
  return mounted
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('add another size', () => {
  it('adds a second card with the next free size and no placements', async () => {
    const { wrapper, store } = await twoSizes()

    expect(cards(wrapper)).toHaveLength(2)
    expect(pedestals(store).map(({ size }) => size)).toEqual(['Medium', 'Small'])
    expect(pedestals(store)[1]?.quantity).toBe(0)
    expect(pedestals(store)[1]?.recipe.size).toBe('Small')
  })

  it('sits next to the card it came from', async () => {
    const { store } = await twoSizes()

    expect(indexOf(store, 'Small')).toBe(indexOf(store, 'Medium') + 1)
  })

  it('keeps flowers left out of the first card', async () => {
    const mounted = await mountEvent()
    const index = indexOf(mounted.store, 'Medium')
    mounted.store.setFlowerUsed(index, 'wax-flower', false)

    mounted.store.addSize(index)

    expect(pedestals(mounted.store)[1]?.excludedFlowerIds).toContain('wax-flower')
  })

  it('counts both sizes in the event', async () => {
    const { store } = await twoSizes()
    store.setQuantity(indexOf(store, 'Medium'), 4)
    store.setQuantity(indexOf(store, 'Small'), 3)
    store.togglePalette('focal', 'focus-rose')
    await flushPromises()

    const designs = store.allocation?.designs.filter(({ designId }) => designId === 'pedestal')
    expect(designs?.map(({ size, quantity }) => [size, quantity])).toEqual([
      ['Medium', 4],
      ['Small', 3],
    ])
    expect(store.workPlan.filter(({ designId }) => designId === 'pedestal')).toHaveLength(2)
  })

  it('offers no size that is already on the event', async () => {
    const { wrapper } = await twoSizes()
    const options = cards(wrapper)[0]?.findAll('select[name="size"] option')

    expect(options?.map((option) => option.text())).toEqual(['Medium', 'Large'])
  })

  it('stops once every size is on the event', async () => {
    const { wrapper } = await twoSizes()
    await cards(wrapper)[0]?.find('.add-size').trigger('click')
    await flushPromises()

    expect(cards(wrapper)).toHaveLength(3)
    expect(wrapper.find('[data-design="pedestal"] .add-size').exists()).toBe(false)
  })

  it('is not offered for a design with one size', async () => {
    const { wrapper } = await mountEvent()

    expect(wrapper.find('[data-design="groom"] .add-size').exists()).toBe(false)
  })

  it('keeps an open recipe open when the size changes', async () => {
    const { wrapper } = await twoSizes()
    await cards(wrapper)[1]?.find('.recipe-toggle').trigger('click')

    await cards(wrapper)[1]?.find('select[name="size"]').setValue('Large')
    await flushPromises()

    expect(cards(wrapper)[1]?.find('.recipe-toggle').text()).toBe('Hide recipe')
  })
})

describe('remove a size', () => {
  it('is only offered when there is another card', async () => {
    const { wrapper } = await mountEvent()
    expect(wrapper.find('[data-design="pedestal"] .remove-size').exists()).toBe(false)

    await wrapper.find('[data-design="pedestal"] .add-size').trigger('click')
    await flushPromises()

    expect(cards(wrapper)[0]?.find('.remove-size').exists()).toBe(true)
    expect(cards(wrapper)[1]?.find('.remove-size').exists()).toBe(true)
  })

  it('removes an empty card without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { wrapper, store } = await twoSizes()

    await cards(wrapper)[1]?.find('.remove-size').trigger('click')
    await flushPromises()

    expect(confirm).not.toHaveBeenCalled()
    expect(pedestals(store).map(({ size }) => size)).toEqual(['Medium'])
  })

  it('asks on the card when it has placements, and Keep it changes nothing', async () => {
    const { wrapper, store } = await twoSizes()
    store.setQuantity(indexOf(store, 'Small'), 2)
    await flushPromises()

    await cards(wrapper)[1]?.find('.remove-size').trigger('click')

    expect(cards(wrapper)[1]?.find('[data-remove-confirm]').text()).toContain('Small Pedestals')
    expect(pedestals(store)).toHaveLength(2)

    await cards(wrapper)[1]?.find('.keep-size').trigger('click')

    expect(cards(wrapper)[1]?.find('[data-remove-confirm]').exists()).toBe(false)
    expect(pedestals(store)).toHaveLength(2)
  })

  it('removes a card with placements without needing a browser pop-up', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper, store } = await twoSizes()
    store.setQuantity(indexOf(store, 'Small'), 2)
    await flushPromises()

    await cards(wrapper)[1]?.find('.remove-size').trigger('click')
    await cards(wrapper)[1]?.find('.confirm-remove').trigger('click')
    await flushPromises()

    expect(confirm).not.toHaveBeenCalled()
    expect(pedestals(store).map(({ size }) => size)).toEqual(['Medium'])
  })

  it('can remove several cards with placements in a row', async () => {
    const { wrapper, store } = await twoSizes()
    await cards(wrapper)[0]?.find('.add-size').trigger('click')
    await flushPromises()
    for (const design of pedestals(store)) design.quantity = 2
    await flushPromises()

    for (const expected of [2, 1]) {
      await cards(wrapper)[0]?.find('.remove-size').trigger('click')
      await cards(wrapper)[0]?.find('.confirm-remove').trigger('click')
      await flushPromises()
      expect(pedestals(store)).toHaveLength(expected)
      expect(wrapper.find('[data-remove-confirm]').exists()).toBe(false)
    }
  })

  it('refuses to remove the last card for a design', async () => {
    const { store } = await mountEvent()

    store.removeSize(indexOf(store, 'Medium'))

    expect(pedestals(store)).toHaveLength(1)
  })
})

describe('telling two sizes apart', () => {
  it('names the size when a design is on the event twice', async () => {
    const { store } = await twoSizes()

    expect(store.designLabel(indexOf(store, 'Small'))).toBe('Pedestals (Small)')
  })

  it('leaves the name alone otherwise', async () => {
    const { store } = await mountEvent()

    expect(store.designLabel(indexOf(store, 'Medium'))).toBe('Pedestals')
  })

  it('shows both sizes in the flowers by design table', async () => {
    const { wrapper, store, router } = await twoSizes()
    store.setQuantity(indexOf(store, 'Medium'), 1)
    store.setQuantity(indexOf(store, 'Small'), 1)
    store.togglePalette('focal', 'focus-rose')
    await router.push(`/events/${store.current?.id}/work-plan`)
    await flushPromises()

    await wrapper.find('input[name="show-matrix"]').setValue(true)

    const headings = wrapper.findAll('[data-matrix] th').map((cell) => cell.text())
    expect(headings).toContain('Pedestals (Medium)')
    expect(headings).toContain('Pedestals (Small)')
  })
})

describe('after a purchase', () => {
  async function purchased() {
    const mounted = await mountEvent()
    const { store } = mounted
    store.setQuantity(indexOf(store, 'Medium'), 2)
    store.togglePalette('focal', 'focus-rose')
    await flushPromises()
    store.markPurchased()
    await flushPromises()
    return mounted
  }

  it('flags a new size as added, and leaves the bought size alone', async () => {
    const { store } = await purchased()
    store.addSize(indexOf(store, 'Medium'))
    store.setQuantity(indexOf(store, 'Small'), 1)
    await flushPromises()

    expect(store.designChangeFor(indexOf(store, 'Medium'))).toBeNull()
    expect(store.designChangeFor(indexOf(store, 'Small'))).toBe('added')
  })

  it('still shows a switched size as changed', async () => {
    const { store } = await purchased()
    store.setSize(indexOf(store, 'Medium'), 'Large')
    await flushPromises()

    expect(store.designChangeFor(indexOf(store, 'Large'))).toBe('changed')
  })
})

describe('sizes that have gone', () => {
  it('stays put when no other size has a recipe', async () => {
    const { wrapper, store } = await mountEvent()
    const catalogue = useCatalogueStore()
    catalogue.recipes = catalogue.recipes.filter(
      ({ designId, size }) => designId !== 'pedestal' || size === 'Medium',
    )
    await flushPromises()

    store.addSize(indexOf(store, 'Medium'))

    expect(pedestals(store)).toHaveLength(1)
    expect(wrapper.find('[data-design="pedestal"] .add-size').exists()).toBe(false)
  })
})
