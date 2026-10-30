import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'

import type { MasterData, PriceReport, Recipe, Size } from '@engine'

import { apiClient } from '../api/client'
import { seed } from '../seed/seed'
import { priceStorage } from '../storage/priceStorage'

const SIZE_ORDER: Size[] = ['Small', 'Medium', 'Large', 'Fixed']

export type CatalogueSource = 'seed' | 'cache' | 'live'

export const useCatalogueStore = defineStore('catalogue', () => {
  const storage = priceStorage()

  const flowers = ref(seed.flowers)
  const suppliers = ref(seed.suppliers)
  const designs = ref(seed.designs)
  const recipes = ref(seed.recipes)
  const prices = ref(seed.prices)

  /** Reports made on this phone and not yet on the server, shown straight away. */
  const pendingReports = ref<PriceReport[]>([])
  /** Report ids voided on this phone and not yet on the server. */
  const pendingVoids = ref<string[]>([])

  const source = ref<CatalogueSource>('seed')
  const version = ref<number | undefined>(undefined)

  /** Every report, with this phone's unsent changes applied. */
  const allPrices = computed(() => {
    const known = new Set(prices.value.map((price) => price.id))
    return [...prices.value, ...pendingReports.value.filter((price) => !known.has(price.id))].map(
      (price): PriceReport =>
        pendingVoids.value.includes(price.id) ? { ...price, status: 'voided' } : price,
    )
  })

  /** The engine has no supplier list, so inactive suppliers' prices are removed here. */
  const activePrices = computed(() => {
    const active = new Set(suppliers.value.filter((item) => item.active).map(({ id }) => id))
    return allPrices.value.filter((price) => active.has(price.supplierId))
  })

  function apply(master: MasterData, from: CatalogueSource) {
    flowers.value = master.flowers
    suppliers.value = master.suppliers
    designs.value = master.designs
    recipes.value = master.recipes
    prices.value = master.prices
    version.value = master.version
    source.value = from
  }

  function currentMaster(): MasterData {
    return JSON.parse(
      JSON.stringify({
        version: version.value ?? 0,
        flowers: toRaw(flowers.value),
        suppliers: toRaw(suppliers.value),
        designs: toRaw(designs.value),
        recipes: toRaw(recipes.value),
        prices: toRaw(prices.value),
      }),
    ) as MasterData
  }

  /** A failure only loses the speed-up, so it's never shown to anyone. */
  async function saveCache(master: MasterData) {
    try {
      await storage.saveMaster(master)
    } catch {
      return
    }
  }

  async function loadCached() {
    try {
      const cached = await storage.loadMaster()
      if (cached) apply(cached, 'cache')
    } catch {
      return
    }
  }

  async function refresh() {
    const reply = await apiClient().fetchMaster(version.value)
    if (reply.status === 'ok') {
      apply(reply.data, 'live')
      await saveCache(reply.data)
    } else if (reply.status === 'unchanged') {
      source.value = 'live'
    }
  }

  async function start() {
    await loadCached()
    await refresh()
  }

  /** Keeps a sent change visible until the next refresh brings it back from the server. */
  function recordSent(report: PriceReport) {
    if (prices.value.some((price) => price.id === report.id)) return
    prices.value = [...prices.value, report]
    void saveCache(currentMaster())
  }

  function recordVoided(reportId: string) {
    prices.value = prices.value.map((price) =>
      price.id === reportId ? { ...price, status: 'voided' } : price,
    )
    void saveCache(currentMaster())
  }

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
    pendingReports,
    pendingVoids,
    allPrices,
    activePrices,
    source,
    version,
    start,
    refresh,
    recordSent,
    recordVoided,
    sizesFor,
    defaultSize,
    recipeFor,
    flowerName,
    supplierName,
    designName,
  }
})
