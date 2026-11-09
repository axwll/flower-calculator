import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'

describe('event store: creating events', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no events', () => {
    const store = useEventStore()

    expect(store.events).toEqual([])
    expect(store.current).toBeNull()
    expect(store.allocation).toBeNull()
  })

  it('creates an event with one entry per design', () => {
    const store = useEventStore()
    const id = store.createEvent({ name: 'June wedding' })
    store.open(id)

    expect(store.current?.name).toBe('June wedding')
    expect(store.current?.designs).toHaveLength(useCatalogueStore().designs.length)
  })

  it('keeps the date and target budget', () => {
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A', date: '2026-07-04', targetBudgetPence: 50000 }))

    expect(store.current).toMatchObject({ date: '2026-07-04', targetBudgetPence: 50000 })
  })

  it('switches optional designs off and starts everything at zero', () => {
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A' }))
    const entry = (designId: string) =>
      store.current?.designs.find((design) => design.designId === designId)

    expect(entry('pedestal')).toMatchObject({ enabled: true, quantity: 0, size: 'Medium' })
    expect(entry('pumpkin')).toMatchObject({ enabled: false, quantity: 0, size: 'Fixed' })
  })

  it('copies the default settings', () => {
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A' }))

    expect(store.current?.settings).toEqual({
      thinBunchPercent: 15,
      priceAmberDays: 14,
      priceRedDays: 30,
      bigChangePercent: 50,
    })
  })

  it('copies recipes, so an edit never reaches the catalogue', () => {
    const store = useEventStore()
    const catalogue = useCatalogueStore()
    store.open(store.createEvent({ name: 'A' }))
    const before = catalogue.recipeFor('top-table', 'Fixed')?.lines[0]?.stemsPerUnit

    const line = store.current?.designs.find((design) => design.designId === 'top-table')?.recipe
      .lines[0]
    if (line) line.stemsPerUnit = 99

    expect(catalogue.recipeFor('top-table', 'Fixed')?.lines[0]?.stemsPerUnit).toBe(before)
  })

  it('gives each event its own id', () => {
    const store = useEventStore()

    expect(store.createEvent({ name: 'A' })).not.toBe(store.createEvent({ name: 'B' }))
  })

  it('reports whether an event could be opened', () => {
    const store = useEventStore()
    const id = store.createEvent({ name: 'A' })

    expect(store.open(id)).toBe(true)
    expect(store.open('ghost')).toBe(false)
    expect(store.current).toBeNull()
  })

  it('allocates the current event', () => {
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A' }))

    expect(store.allocation?.totals.stems).toBe(0)
  })
})

describe('event store: designs added to the library later', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function addCrown(active = true) {
    const catalogue = useCatalogueStore()
    const buttonhole = catalogue.recipeFor('buttonhole', 'Fixed')!
    catalogue.source = 'live'
    catalogue.designs = [
      ...catalogue.designs,
      { id: 'crown', name: 'Flower crown', group: 'Bridal', optional: false, active },
    ]
    catalogue.recipes = [...catalogue.recipes, { ...buttonhole, designId: 'crown' }]
  }

  function crown() {
    return useEventStore().current?.designs.find(({ designId }) => designId === 'crown')
  }

  it('adds them to an event that is not purchased, at zero', async () => {
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A' }))
    addCrown()
    await nextTick()

    expect(crown()).toMatchObject({ size: 'Fixed', quantity: 0, enabled: true })
  })

  it('adds them only once', async () => {
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A' }))
    addCrown()
    await nextTick()
    store.open(store.createEvent({ name: 'B' }))
    store.open(store.events[0]!.id)
    await nextTick()

    expect(store.current?.designs.filter(({ designId }) => designId === 'crown')).toHaveLength(1)
  })

  it('leaves a purchased event as it is', async () => {
    const store = useEventStore()
    const id = store.createEvent({ name: 'A' })
    store.events[0]!.purchase = {} as never
    store.open(id)
    addCrown()
    await nextTick()

    expect(crown()).toBeUndefined()
  })

  it('leaves out designs that are not in use', async () => {
    const store = useEventStore()
    store.open(store.createEvent({ name: 'A' }))
    addCrown(false)
    await nextTick()

    expect(crown()).toBeUndefined()
  })

  it('waits for saved designs rather than the built-in starting ones', async () => {
    const store = useEventStore()
    const id = store.createEvent({ name: 'A' })
    const catalogue = useCatalogueStore()
    store.events[0]!.designs = store.events[0]!.designs.filter(
      ({ designId }) => designId !== 'buttonhole',
    )
    store.open(id)
    await nextTick()

    expect(catalogue.source).toBe('seed')
    expect(store.current?.designs.some(({ designId }) => designId === 'buttonhole')).toBe(false)
  })
})
