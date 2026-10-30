<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { formatPence, resolveOffers } from '@engine'

import PriceAge from '../components/PriceAge.vue'
import { DEFAULT_SETTINGS } from '../pricing'
import { useCatalogueStore } from '../stores/catalogue'

const route = useRoute()
const router = useRouter()
const catalogue = useCatalogueStore()

const supplierId = ref(typeof route.query.supplier === 'string' ? route.query.supplier : '')

watch(supplierId, (value) => {
  void router.replace({ query: value ? { supplier: value } : {} })
})

const suppliers = computed(() =>
  catalogue.suppliers
    .filter((supplier) => supplier.active)
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const rows = computed(() => {
  const now = new Date().toISOString()
  return catalogue.flowers.flatMap((flower) => {
    if (!flower.active || flower.soldAs === 'foraged') return []
    const { offers } = resolveOffers(flower, catalogue.activePrices, DEFAULT_SETTINGS, now)
    const offer = offers.find((item) => item.supplierId === supplierId.value)
    return offer ? [{ flower, offer }] : []
  })
})
</script>

<template>
  <section class="page">
    <h1>Shop mode</h1>
    <label class="field">
      <span class="field-label">Which supplier are you at?</span>
      <select v-model="supplierId" name="shop-supplier">
        <option value="">Choose a supplier</option>
        <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
          {{ supplier.name }}
        </option>
      </select>
    </label>

    <p v-if="supplierId && rows.length === 0" class="muted">No prices from this supplier yet.</p>
    <RouterLink
      v-for="{ flower, offer } in rows"
      :key="flower.id"
      class="card shop-row"
      :to="`/prices/${flower.id}?supplier=${supplierId}&from=shop`"
      :data-shop-flower="flower.id"
    >
      <span>{{ flower.name }}</span>
      <span>{{ formatPence(offer.pricePence) }} <PriceAge :offer="offer" /></span>
    </RouterLink>
  </section>
</template>

<style scoped>
.shop-row {
  display: flex;
  min-height: var(--tap);
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ink);
  text-decoration: none;
}
</style>
