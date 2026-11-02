import { flushPromises } from '@vue/test-utils'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Design, MasterData, Recipe } from '@engine'

import { offlineClient, setApiClient } from '../api/client'
import type { ApiAction, ApiClient, SendResult } from '../api/client'
import { seed } from '../seed/seed'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { useLibraryStore } from '../stores/library'
import { usePricesStore } from '../stores/prices'
import { mountApp, mountEvent } from './helpers'

let sent: ApiAction[]
let reply: SendResult

function client(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    ...offlineClient,
    fetchMaster: async () => ({ status: 'unchanged' }),
    send: async (action) => {
      sent.push(action)
      return reply
    },
    ...overrides,
  }
}

async function mountAdmin(path: string) {
  localStorage.setItem('nickname', 'Mum')
  localStorage.setItem('admin-key', 'the-key')
  localStorage.setItem('admin-on', 'yes')
  return mountApp(path)
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function lastSent<T extends ApiAction['action']>(action: T) {
  const found = sent.at(-1)
  expect(found?.action).toBe(action)
  return found as Extract<ApiAction, { action: T }>
}

function byText(wrapper: VueWrapper, text: string): DOMWrapper<Element> {
  const found = wrapper.findAll('button').find((button) => button.text() === text)
  if (!found) throw new Error(`No button: ${text}`)
  return found
}

function liveMaster(change: (master: MasterData) => void): MasterData {
  const master: MasterData = { ...structuredClone(seed), version: 9 }
  change(master)
  return master
}

beforeEach(() => {
  localStorage.clear()
  sent = []
  reply = { status: 'sent' }
  setApiClient(client())
})

afterEach(() => {
  setApiClient(null)
  vi.restoreAllMocks()
})

describe('admin key check', () => {
  async function checkKey(key: string) {
    const mounted = await mountApp('/settings')
    await mounted.wrapper.find('input[name="nickname"]').setValue('Mum')
    await mounted.wrapper.find('input[name="admin-key"]').setValue(key)
    await mounted.wrapper.find('.check-key').trigger('click')
    await flushPromises()
    return mounted
  }

  it('turns admin on for the right key', async () => {
    const { wrapper } = await checkKey('the-key')

    expect(sent).toEqual([{ action: 'checkAdmin', adminKey: 'the-key' }])
    expect(useLibraryStore().adminOn).toBe(true)
    expect(wrapper.find('.key-status').text()).toBe('Admin on')
  })

  it('remembers admin across launches', async () => {
    await checkKey('the-key')
    await mountApp('/settings')

    expect(useLibraryStore().adminOn).toBe(true)
  })

  it('stays off for a wrong key', async () => {
    reply = { status: 'not-admin', message: 'That admin key isn’t right.' }
    const { wrapper } = await checkKey('guess')

    expect(useLibraryStore().adminOn).toBe(false)
    expect(wrapper.find('.key-status').text()).toBe('That admin key isn’t right.')
  })

  it('says so when there is no connection', async () => {
    reply = { status: 'retry' }
    const { wrapper } = await checkKey('the-key')

    expect(useLibraryStore().adminOn).toBe(false)
    expect(wrapper.find('.key-status').text()).toContain('connection')
  })

  it('needs a nickname first, for the change log', async () => {
    const { wrapper } = await mountApp('/settings')
    await wrapper.find('input[name="admin-key"]').setValue('the-key')
    await wrapper.find('.check-key').trigger('click')
    await flushPromises()

    expect(sent).toEqual([])
    expect(wrapper.find('.key-status').text()).toContain('nickname')
  })

  it('turns admin off when the key is changed', async () => {
    const { wrapper } = await checkKey('the-key')
    await wrapper.find('input[name="admin-key"]').setValue('another')

    expect(useLibraryStore().adminOn).toBe(false)
  })

  it('turns admin off when a save is refused for the key', async () => {
    const { wrapper } = await mountAdmin('/library/suppliers/new')
    reply = { status: 'not-admin', message: 'That admin key isn’t right.' }
    await wrapper.find('input[name="name"]').setValue('Market')
    await submit(wrapper)

    expect(useLibraryStore().adminOn).toBe(false)
    expect(wrapper.find('[role="alert"]').text()).toBe('That admin key isn’t right.')
  })
})

describe('library tab', () => {
  it('points everyone else to Settings', async () => {
    const { wrapper } = await mountApp('/library')

    expect(wrapper.text()).toContain('admin key')
    expect(wrapper.find('[data-library-design]').exists()).toBe(false)
  })

  it('sends anyone else away from the edit screens', async () => {
    const { router } = await mountApp('/library/flowers/scabious')

    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('lists designs for an admin, and shows sizes', async () => {
    const { wrapper } = await mountAdmin('/library')

    expect(wrapper.find('[data-library-design="pedestal"]').text()).toContain('3 sizes')
  })

  it('switches to flowers and suppliers, and remembers which', async () => {
    const { wrapper, router } = await mountAdmin('/library')
    await byText(wrapper, 'Flowers').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-library-flower="scabious"]').exists()).toBe(true)
    expect(router.currentRoute.value.query.show).toBe('flowers')

    await byText(wrapper, 'Suppliers').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-library-supplier="wholesaler-a"]').exists()).toBe(true)
  })

  it('shows what is retired', async () => {
    const { wrapper } = await mountAdmin('/library?show=flowers')
    const catalogue = useCatalogueStore()
    catalogue.flowers = catalogue.flowers.map((flower) =>
      flower.id === 'scabious' ? { ...flower, active: false } : flower,
    )
    await flushPromises()

    expect(wrapper.find('[data-library-flower="scabious"]').text()).toContain('Retired')
  })
})

describe('flower editor', () => {
  it('adds a flower with a readable id', async () => {
    const { wrapper, router } = await mountAdmin('/library/flowers/new')
    await wrapper.find('input[name="name"]').setValue('Peony (pink)')
    await wrapper.find('input[value="focal"]').setValue(true)
    await submit(wrapper)

    const { flower, adminKey, nickname } = lastSent('saveFlower')
    expect(flower).toMatchObject({
      name: 'Peony (pink)',
      roles: ['focal'],
      soldAs: 'bunch',
      trackLeftovers: true,
      active: true,
    })
    expect(flower.id).toMatch(/^peony-pink-[a-z0-9]+$/)
    expect({ adminKey, nickname }).toEqual({ adminKey: 'the-key', nickname: 'Mum' })
    expect(router.currentRoute.value.fullPath).toBe('/library?show=flowers')
  })

  it('edits a flower, keeping its id', async () => {
    const { wrapper } = await mountAdmin('/library/flowers/scabious')
    expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe(
      'Scabious / paw paw',
    )
    await wrapper.find('input[name="name"]').setValue('Scabious')
    await submit(wrapper)

    expect(lastSent('saveFlower').flower).toMatchObject({ id: 'scabious', name: 'Scabious' })
  })

  it('needs a name and a role', async () => {
    const { wrapper } = await mountAdmin('/library/flowers/new')
    await submit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('name')

    await wrapper.find('input[name="name"]').setValue('Peony')
    await submit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('role')
    expect(sent).toEqual([])
  })

  it('retires a flower', async () => {
    const { wrapper } = await mountAdmin('/library/flowers/scabious')
    await wrapper.find('input[name="active"]').setValue(false)
    await submit(wrapper)

    expect(lastSent('saveFlower').flower.active).toBe(false)
  })

  it('warns that prices may need updating when sold as changes', async () => {
    const { wrapper } = await mountAdmin('/library/flowers/focus-rose')
    expect(wrapper.text()).not.toContain('prices may need updating')

    await wrapper.find('select[name="sold-as"]').setValue('stem')

    expect(wrapper.text()).toContain('prices may need updating')
  })

  it('links to the price form when a bought flower has no price', async () => {
    const { wrapper } = await mountAdmin('/library/flowers/scabious')

    expect(wrapper.find('a[href="/prices/scabious"]').exists()).toBe(true)
  })

  it('keeps what was typed when a save fails', async () => {
    reply = { status: 'retry' }
    const { wrapper, router } = await mountAdmin('/library/flowers/scabious')
    await wrapper.find('input[name="name"]').setValue('Typed')
    await submit(wrapper)

    expect(router.currentRoute.value.path).toBe('/library/flowers/scabious')
    expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe('Typed')
    expect(wrapper.find('[role="alert"]').text()).toContain('connection')
  })

  it('blocks a second tap while saving', async () => {
    let finish: (result: SendResult) => void = () => undefined
    setApiClient(
      client({
        send: (action) => {
          sent.push(action)
          return new Promise((resolve) => (finish = resolve))
        },
      }),
    )
    const { wrapper } = await mountAdmin('/library/flowers/scabious')
    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')

    expect(sent).toHaveLength(1)
    expect(wrapper.text()).toContain('Saving…')

    finish({ status: 'sent' })
    await flushPromises()
  })

  it('shows the saved flower after refreshing', async () => {
    const send = client().send
    let saved = false
    setApiClient(
      client({
        send: async (action) => {
          saved = true
          return send(action)
        },
        fetchMaster: async () =>
          saved
            ? {
                status: 'ok',
                data: liveMaster(({ flowers }) => {
                  flowers.find(({ id }) => id === 'scabious')!.name = 'Renamed'
                }),
              }
            : { status: 'unchanged' },
      }),
    )
    const { wrapper } = await mountAdmin('/library/flowers/scabious')
    await submit(wrapper)

    expect(wrapper.find('[data-library-flower="scabious"]').text()).toContain('Renamed')
  })
})

describe('retired flowers', () => {
  function retire() {
    const catalogue = useCatalogueStore()
    catalogue.flowers = catalogue.flowers.map((flower) =>
      flower.id === 'sunflower' ? { ...flower, active: false } : flower,
    )
  }

  it('leaves them out of the palette and swap lists', async () => {
    const { wrapper } = await mountEvent()
    retire()
    await wrapper.find('[data-design="top-table"] .recipe-toggle').trigger('click')

    expect(wrapper.find('[data-design="top-table"]').html()).not.toContain('value="sunflower"')
  })
})

describe('supplier list', () => {
  it('adds a supplier', async () => {
    const { wrapper, router } = await mountAdmin('/library/suppliers/new')
    await wrapper.find('input[name="name"]').setValue('Flower Market')
    await wrapper.find('select[name="type"]').setValue('other')
    await submit(wrapper)

    expect(lastSent('saveSupplier').supplier).toMatchObject({
      name: 'Flower Market',
      type: 'other',
      active: true,
    })
    expect(router.currentRoute.value.fullPath).toBe('/library?show=suppliers')
  })

  it('needs a name', async () => {
    const { wrapper } = await mountAdmin('/library/suppliers/new')
    await submit(wrapper)

    expect(wrapper.find('[role="alert"]').text()).toContain('name')
    expect(sent).toEqual([])
  })

  it('retires a supplier', async () => {
    const { wrapper } = await mountAdmin('/library/suppliers/wholesaler-a')
    await wrapper.find('input[name="active"]').setValue(false)
    await submit(wrapper)

    expect(lastSent('saveSupplier').supplier).toMatchObject({ id: 'wholesaler-a', active: false })
  })
})

describe('designs', () => {
  it('adds a design with no recipe yet, then opens it', async () => {
    const { wrapper, router } = await mountAdmin('/library/designs/new')
    await wrapper.find('input[name="name"]').setValue('Flower crown')
    await wrapper.find('input[name="group"]').setValue('Bridal')
    await submit(wrapper)

    const { design } = lastSent('saveDesign')
    expect(design).toMatchObject({ name: 'Flower crown', group: 'Bridal', optional: false })
    expect(router.currentRoute.value.path).toBe(`/library/designs/${design.id}`)
  })

  it('needs a name and a group', async () => {
    const { wrapper } = await mountAdmin('/library/designs/new')
    await submit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('name')

    await wrapper.find('input[name="name"]').setValue('Crown')
    await submit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('group')
  })

  it('retires a design', async () => {
    const { wrapper } = await mountAdmin('/library/designs/corsage')
    await wrapper.find('input[name="active"]').setValue(false)
    await wrapper.find('form.design-form').trigger('submit')
    await flushPromises()

    expect(lastSent('saveDesign').design).toMatchObject({ id: 'corsage', active: false })
  })

  it('leaves a retired design out of new events', async () => {
    await mountApp()
    const catalogue = useCatalogueStore()
    catalogue.designs = catalogue.designs.map((design): Design =>
      design.id === 'corsage' ? { ...design, active: false } : design,
    )
    const store = useEventStore()
    store.open(store.createEvent({ name: 'New' }))

    expect(store.current?.designs.map(({ designId }) => designId)).not.toContain('corsage')
  })

  it('offers no recipe or variant for a leftover pool', async () => {
    const { wrapper } = await mountAdmin('/library/designs/table-vases')

    expect(wrapper.find('.recipe-form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Make a variant')
  })
})

describe('recipe editor', () => {
  async function openRecipe(designId = 'buttonhole') {
    return mountAdmin(`/library/designs/${designId}`)
  }

  async function saveRecipe(wrapper: VueWrapper) {
    await wrapper.find('form.recipe-form').trigger('submit')
    await flushPromises()
  }

  it('says existing events will not change', async () => {
    const { wrapper } = await openRecipe()

    expect(wrapper.find('.recipe-form').text()).toContain('Existing events keep their own copy')
  })

  it('shows the total stems', async () => {
    const { wrapper } = await openRecipe()

    expect(wrapper.find('.recipe-total').text()).toBe('5 stems')
  })

  it('removes a line', async () => {
    const { wrapper } = await openRecipe()
    await wrapper.find('[aria-label="Remove Focus rose (white)"]').trigger('click')
    await saveRecipe(wrapper)

    const { recipe } = lastSent('saveRecipe')
    expect(recipe.designId).toBe('buttonhole')
    expect(recipe.size).toBe('Fixed')
    expect(recipe.lines.map((line) => line.kind === 'named' && line.flowerId)).toEqual([
      'santini',
      'wax-flower',
      'scabious',
    ])
  })

  it('adds a flower line and a role line', async () => {
    const { wrapper } = await openRecipe()
    await wrapper.find('select[name="add-line"]').setValue('flower:sunflower')
    await wrapper.find('select[name="add-line"]').setValue('role:filler')
    await saveRecipe(wrapper)

    expect(lastSent('saveRecipe').recipe.lines.slice(-2)).toEqual([
      { kind: 'named', flowerId: 'sunflower', stemsPerUnit: 1 },
      { kind: 'role', role: 'filler', stemsPerUnit: 1 },
    ])
  })

  it('offers no retired flowers to add', async () => {
    const { wrapper } = await openRecipe()
    const catalogue = useCatalogueStore()
    catalogue.flowers = catalogue.flowers.map((flower) =>
      flower.id === 'sunflower' ? { ...flower, active: false } : flower,
    )
    await flushPromises()

    expect(wrapper.find('select[name="add-line"]').html()).not.toContain('flower:sunflower')
  })

  it('refuses a line at zero stems and an empty recipe', async () => {
    const { wrapper } = await openRecipe('corsage')
    await wrapper.find('[aria-label="Fewer Focus rose (white)"]').trigger('click')
    await saveRecipe(wrapper)
    expect(wrapper.find('.recipe-form [role="alert"]').text()).toContain('at least one stem')

    for (const name of ['Focus rose (white)', 'Dahlia (orange)', 'Scabious / paw paw']) {
      await wrapper.find(`[aria-label="Remove ${name}"]`).trigger('click')
    }
    await saveRecipe(wrapper)
    expect(wrapper.find('.recipe-form [role="alert"]').text()).toContain('at least one line')
    expect(sent).toEqual([])
  })

  it('leaves flowers out of a role line', async () => {
    const { wrapper } = await openRecipe('top-table')
    await wrapper.find('input[name="leave-out"][value="dahlia-dark"]').setValue(true)
    await saveRecipe(wrapper)

    expect(lastSent('saveRecipe').recipe.excludedFlowerIds).toEqual(['dahlia-dark'])
  })

  it('only offers to leave out flowers its role lines could use', async () => {
    const { wrapper } = await openRecipe('pumpkin')

    expect(wrapper.find('input[value="scabious"]').exists()).toBe(true)
    expect(wrapper.find('input[value="dahlia-dark"]').exists()).toBe(false)
  })

  it('has nothing to leave out with no role lines', async () => {
    const { wrapper } = await openRecipe()

    expect(wrapper.find('input[name="leave-out"]').exists()).toBe(false)
  })

  it('switches between sizes', async () => {
    const { wrapper } = await openRecipe('pedestal')
    expect(wrapper.find('.recipe-total').text()).toBe('20 stems')

    await wrapper.find('select[name="library-size"]').setValue('Large')
    await flushPromises()

    expect(wrapper.find('.recipe-total').text()).not.toBe('20 stems')
  })

  it('starts a new size from a copy of the one showing', async () => {
    const { wrapper } = await openRecipe('pedestal')
    await wrapper.find('select[name="library-size"]').setValue('Medium')
    await flushPromises()
    useCatalogueStore().recipes = useCatalogueStore().recipes.filter(
      (recipe) => !(recipe.designId === 'pedestal' && recipe.size === 'Large'),
    )
    await flushPromises()
    await wrapper.find('select[name="add-size"]').setValue('Large')
    await flushPromises()
    await saveRecipe(wrapper)

    const { recipe } = lastSent('saveRecipe')
    expect(recipe.size).toBe('Large')
    expect(recipe.lines).toEqual(
      seed.recipes.find((item) => item.designId === 'pedestal' && item.size === 'Medium')?.lines,
    )
  })

  it('can cancel a new size and go back', async () => {
    const { wrapper } = await openRecipe('pedestal')
    useCatalogueStore().recipes = useCatalogueStore().recipes.filter(
      (recipe) => !(recipe.designId === 'pedestal' && recipe.size === 'Large'),
    )
    await flushPromises()
    await wrapper.find('select[name="add-size"]').setValue('Large')
    await flushPromises()
    await wrapper.find('.cancel-size').trigger('click')
    await flushPromises()

    const size = wrapper.find('select[name="library-size"]').element as HTMLSelectElement
    expect(size.value).toBe('Small')
  })

  it('offers no other size beside Fixed', async () => {
    const { wrapper } = await openRecipe()

    expect(wrapper.find('select[name="add-size"]').exists()).toBe(false)
  })

  it('offers only sizes that fit beside the ones in use', async () => {
    const { wrapper } = await openRecipe('pedestal')
    useCatalogueStore().recipes = useCatalogueStore().recipes.filter(
      (recipe) => !(recipe.designId === 'pedestal' && recipe.size === 'Large'),
    )
    await flushPromises()

    const options = wrapper.findAll('select[name="add-size"] option').map((item) => item.text())
    expect(options).toContain('Large')
    expect(options).not.toContain('Fixed')
  })

  it('retires a size after asking', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper } = await openRecipe('pedestal')
    await byText(wrapper, 'Retire this size').trigger('click')
    await flushPromises()

    expect(lastSent('saveRecipe').recipe).toMatchObject({
      designId: 'pedestal',
      size: 'Small',
      active: false,
    })
  })

  it('leaves a retired size alone if the answer is no', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper } = await openRecipe('pedestal')
    await byText(wrapper, 'Retire this size').trigger('click')

    expect(sent).toEqual([])
  })
})

describe('catalogue and events', () => {
  function replaceButtonhole(change: Partial<Recipe>) {
    const catalogue = useCatalogueStore()
    catalogue.recipes = catalogue.recipes.map((recipe) =>
      recipe.designId === 'buttonhole' ? { ...recipe, ...change } : recipe,
    )
  }

  it('keeps retired sizes out of the choices', async () => {
    await mountApp()
    const catalogue = useCatalogueStore()
    catalogue.recipes = catalogue.recipes.map((recipe) =>
      recipe.designId === 'pedestal' && recipe.size === 'Large'
        ? { ...recipe, active: false }
        : recipe,
    )

    expect(catalogue.sizesFor('pedestal')).toEqual(['Small', 'Medium'])
    expect(catalogue.recipeFor('pedestal', 'Large')).toBeUndefined()
  })

  it('keeps an event on a size that was retired afterwards', async () => {
    const { wrapper, store } = await mountEvent()
    const index = store.current!.designs.findIndex(({ designId }) => designId === 'pedestal')
    store.setSize(index, 'Large')
    const catalogue = useCatalogueStore()
    catalogue.recipes = catalogue.recipes.map((recipe) =>
      recipe.designId === 'pedestal' && recipe.size === 'Large'
        ? { ...recipe, active: false }
        : recipe,
    )
    await flushPromises()

    const size = wrapper.find('[data-design="pedestal"] select[name="size"]')
    expect((size.element as HTMLSelectElement).value).toBe('Large')
  })

  it('never changes an existing event, while a new one gets the edit', async () => {
    const { store } = await mountEvent()
    const before = JSON.stringify(store.current)
    const edited = [{ kind: 'named' as const, flowerId: 'sunflower', stemsPerUnit: 9 }]
    replaceButtonhole({ lines: edited, version: 2 })

    expect(JSON.stringify(store.current)).toBe(before)

    store.open(store.createEvent({ name: 'New' }))
    const entry = store.current?.designs.find(({ designId }) => designId === 'buttonhole')
    expect(entry?.recipe.lines).toEqual(edited)
  })

  it('copies leave-out lists into new events', async () => {
    const { store } = await mountEvent()
    replaceButtonhole({ excludedFlowerIds: ['dahlia-dark'] })
    store.open(store.createEvent({ name: 'New' }))

    const entry = store.current?.designs.find(({ designId }) => designId === 'buttonhole')
    expect(entry?.excludedFlowerIds).toEqual(['dahlia-dark'])
  })

  it('adds the leave-out list when an event changes size', async () => {
    const { store } = await mountEvent()
    const catalogue = useCatalogueStore()
    catalogue.recipes = catalogue.recipes.map((recipe) =>
      recipe.designId === 'pedestal' && recipe.size === 'Large'
        ? { ...recipe, excludedFlowerIds: ['dahlia-dark'] }
        : recipe,
    )
    const index = store.current!.designs.findIndex(({ designId }) => designId === 'pedestal')
    store.setFlowerUsed(index, 'sunflower', false)
    store.setSize(index, 'Large')

    expect(store.current?.designs[index]?.excludedFlowerIds).toEqual(['sunflower', 'dahlia-dark'])
  })
})

describe('make a variant', () => {
  async function makeVariant(name: string) {
    const mounted = await mountAdmin('/library/designs/pedestal')
    await byText(mounted.wrapper, 'Make a variant').trigger('click')
    await mounted.wrapper.find('input[name="variant-name"]').setValue(name)
    await byText(mounted.wrapper, 'Copy design').trigger('click')
    await flushPromises()
    return mounted
  }

  it('copies every size to a new design in one save', async () => {
    await makeVariant('Pedestals (no dahlia)')

    const { design, recipes = [] } = lastSent('saveDesign')
    expect(design).toEqual({
      id: expect.stringMatching(/^pedestals-no-dahlia-/) as string,
      name: 'Pedestals (no dahlia)',
      group: 'Reception',
      optional: false,
    })
    expect(recipes.map(({ size }) => size)).toEqual(['Small', 'Medium', 'Large'])
    expect(recipes.every(({ designId }) => designId === design.id)).toBe(true)
    expect(sent).toHaveLength(1)
  })

  it('opens the new design ready to edit', async () => {
    const { router } = await makeVariant('Pedestals (no dahlia)')

    expect(router.currentRoute.value.path).toBe(
      `/library/designs/${lastSent('saveDesign').design.id}`,
    )
  })

  it('leaves the original alone', async () => {
    await makeVariant('Pedestals (no dahlia)')

    expect(sent.every((action) => action.action === 'saveDesign')).toBe(true)
    expect(lastSent('saveDesign').design.id).not.toBe('pedestal')
  })

  it('needs a name', async () => {
    const { wrapper } = await makeVariant(' ')

    expect(sent).toEqual([])
    expect(wrapper.find('[role="alert"]').text()).toContain('name')
  })
})

describe('save to library', () => {
  async function openEventRecipe() {
    localStorage.setItem('nickname', 'Mum')
    localStorage.setItem('admin-key', 'the-key')
    localStorage.setItem('admin-on', 'yes')
    const mounted = await mountEvent()
    await mounted.wrapper.find('[data-design="top-table"] .recipe-toggle').trigger('click')
    return mounted
  }

  function card(wrapper: VueWrapper) {
    return wrapper.find('[data-design="top-table"]')
  }

  it('is hidden from anyone else', async () => {
    const { wrapper } = await mountEvent()
    await wrapper.find('[data-design="top-table"] .recipe-toggle').trigger('click')

    expect(card(wrapper).text()).not.toContain('Save to library')
  })

  it('updates the recipe with the event’s lines and leave-out list', async () => {
    const { wrapper, store } = await openEventRecipe()
    const index = store.current!.designs.findIndex(({ designId }) => designId === 'top-table')
    store.setLineStems(index, 0, 0)
    store.setLineStems(index, 1, 8)
    store.setFlowerUsed(index, 'dahlia-dark', false)
    await card(wrapper).find('.save-to-library').trigger('click')
    await card(wrapper).find('.update-recipe').trigger('click')
    await flushPromises()

    const { recipe } = lastSent('saveRecipe')
    expect(recipe).toMatchObject({
      designId: 'top-table',
      size: 'Fixed',
      excludedFlowerIds: ['dahlia-dark'],
    })
    expect(recipe.lines).toHaveLength(3)
    expect(recipe.lines[0]).toEqual({ kind: 'role', role: 'focal', stemsPerUnit: 8 })
    expect(card(wrapper).text()).toContain('Saved')
  })

  it('saves as a new design, leaving the event as it is', async () => {
    const { wrapper, store } = await openEventRecipe()
    const before = JSON.stringify(store.current)
    await card(wrapper).find('.save-to-library').trigger('click')
    await card(wrapper).find('input[name="new-design-name"]').setValue('Top table (no dahlia)')
    await card(wrapper).find('.save-new-design').trigger('click')
    await flushPromises()

    const { design, recipes = [] } = lastSent('saveDesign')
    expect(design).toMatchObject({ name: 'Top table (no dahlia)', group: 'Reception' })
    expect(recipes).toHaveLength(1)
    expect(recipes[0]?.designId).toBe(design.id)
    expect(JSON.stringify(store.current)).toBe(before)
  })

  it('says so when it could not save, leaving the event alone', async () => {
    reply = { status: 'retry' }
    const { wrapper, store } = await openEventRecipe()
    const before = JSON.stringify(store.current)
    await card(wrapper).find('.save-to-library').trigger('click')
    await card(wrapper).find('.update-recipe').trigger('click')
    await flushPromises()

    expect(card(wrapper).find('[role="alert"]').text()).toContain('connection')
    expect(JSON.stringify(store.current)).toBe(before)
  })

  it('refuses a recipe with every line at zero', async () => {
    const { wrapper, store } = await openEventRecipe()
    const index = store.current!.designs.findIndex(({ designId }) => designId === 'top-table')
    store.current!.designs[index]!.recipe.lines.forEach((_line, line) =>
      store.setLineStems(index, line, 0),
    )
    await card(wrapper).find('.save-to-library').trigger('click')
    await card(wrapper).find('.update-recipe').trigger('click')
    await flushPromises()

    expect(sent).toEqual([])
    expect(card(wrapper).find('[role="alert"]').text()).toContain('at least one')
  })
})

describe('library store', () => {
  it('asks for a nickname before saving', async () => {
    await mountApp()
    usePricesStore().setAdminKey('the-key')
    const message = await useLibraryStore().save({
      action: 'saveSupplier',
      supplier: { id: 's', name: 'S', type: 'other', active: true },
    })

    expect(message).toContain('nickname')
    expect(sent).toEqual([])
  })
})
