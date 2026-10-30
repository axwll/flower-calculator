import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { useCatalogueStore } from '../stores/catalogue'
import { mountEvent } from './helpers'

function card(wrapper: VueWrapper, designId: string): DOMWrapper<Element> {
  return wrapper.find(`[data-design="${designId}"]`)
}

async function more(wrapper: VueWrapper, designId: string, name: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await card(wrapper, designId).find(`button[aria-label="More ${name}"]`).trigger('click')
  }
}

function entry(store: Awaited<ReturnType<typeof mountEvent>>['store'], designId: string) {
  const found = store.current?.designs.find((design) => design.designId === designId)
  if (!found) throw new Error(`No design ${designId}`)
  return found
}

describe('designs step', () => {
  it('shows a card for every design, grouped', async () => {
    const { wrapper } = await mountEvent()

    expect(wrapper.findAll('[data-design]')).toHaveLength(useCatalogueStore().designs.length)
    expect(wrapper.findAll('h2.group').map((heading) => heading.text())).toEqual([
      'Bridal',
      'Reception',
    ])
  })

  it('changes the totals when a design is added', async () => {
    const { wrapper, store } = await mountEvent()
    await more(wrapper, 'bridal-bouquet', 'Bridal bouquet')

    expect(store.allocation?.totals.stems).toBe(25)
  })

  it('does not go below 0', async () => {
    const { wrapper } = await mountEvent()

    expect(
      card(wrapper, 'groom').find('button[aria-label="Fewer Groom"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('accepts a typed quantity', async () => {
    const { wrapper, store } = await mountEvent()
    await card(wrapper, 'buttonhole').find('input[aria-label="Buttonholes"]').setValue('12')

    expect(entry(store, 'buttonhole').quantity).toBe(12)
  })

  it('ignores a typed quantity that is not a whole number', async () => {
    const { wrapper, store } = await mountEvent()
    const input = card(wrapper, 'buttonhole').find<HTMLInputElement>(
      'input[aria-label="Buttonholes"]',
    )
    await input.setValue('2.5')

    expect(entry(store, 'buttonhole').quantity).toBe(0)
    expect(input.element.value).toBe('0')
  })

  it('offers only the sizes that have a recipe', async () => {
    const { wrapper } = await mountEvent()
    const options = card(wrapper, 'pedestal').findAll('select[name="size"] option')

    expect(options.map((option) => option.text())).toEqual(['Small', 'Medium', 'Large'])
  })

  it('hides the size picker when there is only one size', async () => {
    const { wrapper } = await mountEvent()

    expect(card(wrapper, 'groom').find('select[name="size"]').exists()).toBe(false)
  })

  it('swaps the recipe when the size changes', async () => {
    const { wrapper, store } = await mountEvent()
    await card(wrapper, 'pedestal').find('select[name="size"]').setValue('Large')

    expect(entry(store, 'pedestal').recipe.size).toBe('Large')
    expect(entry(store, 'pedestal').recipe.lines).toHaveLength(5)
  })

  it('keeps optional designs switched off until asked', async () => {
    const { wrapper, store } = await mountEvent()
    const pumpkins = card(wrapper, 'pumpkin')

    expect(pumpkins.find('input[aria-label="Pumpkins"]').exists()).toBe(false)

    await pumpkins.find('input[type="checkbox"]').setValue(true)

    expect(entry(store, 'pumpkin').enabled).toBe(true)
    expect(card(wrapper, 'pumpkin').find('input[aria-label="Pumpkins"]').exists()).toBe(true)
  })

  it('gives the leftover pool a quantity but no recipe', async () => {
    const { wrapper } = await mountEvent()
    const vases = card(wrapper, 'table-vases')
    await vases.find('input[type="checkbox"]').setValue(true)

    expect(card(wrapper, 'table-vases').text()).toContain('spare stems')
    expect(card(wrapper, 'table-vases').find('button.recipe-toggle').exists()).toBe(false)
  })
})

describe('recipe editor', () => {
  async function openRecipe(designId: string) {
    const mounted = await mountEvent()
    await card(mounted.wrapper, designId).find('button.recipe-toggle').trigger('click')
    return mounted
  }

  it('shows the recipe lines', async () => {
    const { wrapper } = await openRecipe('top-table')
    const text = card(wrapper, 'top-table').text()

    expect(text).toContain('Hydrangea heads')
    expect(text).toContain('Focal')
    expect(text).toContain('this event only')
  })

  it('changes a count for this event only', async () => {
    const { wrapper, store } = await openRecipe('top-table')
    await card(wrapper, 'top-table').find('button[aria-label="More Focal"]').trigger('click')

    expect(entry(store, 'top-table').recipe.lines[1]?.stemsPerUnit).toBe(8)
    expect(useCatalogueStore().recipeFor('top-table', 'Fixed')?.lines[1]?.stemsPerUnit).toBe(7)
  })

  it('swaps a role for a named flower for this event only', async () => {
    const { wrapper, store } = await openRecipe('top-table')
    await card(wrapper, 'top-table').find('select[name="swap-1"]').setValue('dahlia-dark')

    expect(entry(store, 'top-table').recipe.lines[1]).toEqual({
      kind: 'named',
      flowerId: 'dahlia-dark',
      stemsPerUnit: 7,
    })
    expect(useCatalogueStore().recipeFor('top-table', 'Fixed')?.lines[1]?.kind).toBe('role')
  })

  it('offers no swap on a named line', async () => {
    const { wrapper } = await openRecipe('top-table')

    expect(card(wrapper, 'top-table').find('select[name="swap-0"]').exists()).toBe(false)
  })

  it('closes again', async () => {
    const { wrapper } = await openRecipe('top-table')
    await card(wrapper, 'top-table').find('button.recipe-toggle').trigger('click')

    expect(card(wrapper, 'top-table').text()).not.toContain('this event only')
  })
})
