import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Recipe, Size } from '@engine'

import { seed } from '../seed/seed'

const SIZE_ORDER: Size[] = ['Small', 'Medium', 'Large', 'Fixed']

export const useCatalogueStore = defineStore('catalogue', () => {
  const flowers = ref(seed.flowers)
  const suppliers = ref(seed.suppliers)
  const designs = ref(seed.designs)
  const recipes = ref(seed.recipes)
  const prices = ref(seed.prices)

  /** The engine has no supplier list, so inactive suppliers' prices are removed here. */
  const activePrices = computed(() => {
    const active = new Set(suppliers.value.filter((item) => item.active).map(({ id }) => id))
    return prices.value.filter((price) => active.has(price.supplierId))
  })

  function sizesFor(designId: string): Size[] {
    const sizes = recipes.value
      .filter((recipe) => recipe.designId === designId)
      .map((recipe) => recipe.size)
    return SIZE_ORDER.filter((size) => sizes.includes(size))
  }

  function defaultSize(designId: string): Size | undefined {
    const sizes = sizesFor(designId)
    return sizes.includes('Medium') ? 'Medium' : sizes[0]
  }

  function recipeFor(designId: string, size: Size): Recipe | undefined {
    return recipes.value.find((recipe) => recipe.designId === designId && recipe.size === size)
  }

  function flowerName(id: string): string {
    return flowers.value.find((flower) => flower.id === id)?.name ?? id
  }

  function supplierName(id: string): string {
    return suppliers.value.find((supplier) => supplier.id === id)?.name ?? id
  }

  function designName(id: string): string {
    return designs.value.find((design) => design.id === id)?.name ?? id
  }

  return {
    flowers,
    suppliers,
    designs,
    recipes,
    prices,
    activePrices,
    sizesFor,
    defaultSize,
    recipeFor,
    flowerName,
    supplierName,
    designName,
  }
})
