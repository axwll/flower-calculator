import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

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
