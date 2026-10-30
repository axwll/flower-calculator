import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCatalogueStore } from '../stores/catalogue'

describe('catalogue store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('lists sizes in Small, Medium, Large, Fixed order', () => {
    expect(useCatalogueStore().sizesFor('pedestal')).toEqual(['Small', 'Medium', 'Large'])
  })

  it('finds no sizes for an unknown design', () => {
    expect(useCatalogueStore().sizesFor('ghost')).toEqual([])
  })

  it('defaults to Medium where it exists', () => {
    expect(useCatalogueStore().defaultSize('pedestal')).toBe('Medium')
  })

  it('defaults to the only size otherwise', () => {
    expect(useCatalogueStore().defaultSize('top-table')).toBe('Fixed')
  })

  it('finds a recipe by design and size', () => {
    expect(useCatalogueStore().recipeFor('pedestal', 'Large')?.size).toBe('Large')
  })

  it('leaves inactive suppliers out of prices', () => {
    const store = useCatalogueStore()
    const [first] = store.suppliers
    const count = store.prices.filter((price) => price.supplierId === first?.id).length
    store.suppliers = store.suppliers.map((supplier) =>
      supplier.id === first?.id ? { ...supplier, active: false } : supplier,
    )

    expect(count).toBeGreaterThan(0)
    expect(store.activePrices).toHaveLength(store.prices.length - count)
  })

  it('looks up names, falling back to the id', () => {
    const store = useCatalogueStore()

    expect(store.flowerName('focus-rose')).toBe('Focus rose (white)')
    expect(store.flowerName('ghost')).toBe('ghost')
    expect(store.supplierName('wholesaler-a')).toBe('Wholesaler A')
    expect(store.supplierName('ghost')).toBe('ghost')
    expect(store.designName('pedestal')).toBe('Pedestals')
    expect(store.designName('ghost')).toBe('ghost')
  })
})
