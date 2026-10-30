<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatPence, resolveOffers } from '@engine'

import PriceAge from '../components/PriceAge.vue'
import { DEFAULT_SETTINGS } from '../pricing'
import { useCatalogueStore } from '../stores/catalogue'
import { usePricesStore } from '../stores/prices'
import { plural } from '../wording'

const catalogue = useCatalogueStore()
const prices = usePricesStore()

const search = ref('')

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  const now = new Date().toISOString()
  return catalogue.flowers
    .filter((flower) => flower.active && flower.soldAs !== 'foraged')
    .filter((flower) => flower.name.toLowerCase().includes(term))
    .map((flower) => ({
      flower,
      offers: resolveOffers(flower, catalogue.activePrices, DEFAULT_SETTINGS, now).offers,
    }))
})
</script>

<template>
  <section class="page">
    <h1>Prices</h1>
    <p v-if="catalogue.source !== 'live'" class="muted small">
      Showing saved prices, which may be out of date.
    </p>
    <p v-if="prices.queue.length > 0" class="badge badge-warn">
      {{ plural(prices.queue.length, 'update') }} pending sync
    </p>
    <div v-for="item in prices.refused" :key="item.id" class="card refused" role="alert">
      <p>A price update wasn't accepted: {{ item.message }}</p>
      <button
        class="button button-quiet dismiss-refused"
        type="button"
        @click="prices.dismissRefused(item.id)"
      >
        Dismiss
      </button>
    </div>

    <RouterLink class="button button-primary shop-link" to="/prices/shop">Shop mode</RouterLink>
    <label class="field">
      <span class="field-label">Find a flower</span>
      <input v-model="search" name="search" type="text" autocomplete="off" />
    </label>

    <p v-if="rows.length === 0" class="muted">No flowers match.</p>
    <RouterLink
      v-for="{ flower, offers } in rows"
      :key="flower.id"
      class="card price-row"
      :to="`/prices/${flower.id}`"
      :data-price-flower="flower.id"
    >
      <strong>{{ flower.name }}</strong>
      <span v-if="offers.length === 0" class="muted small">No price yet</span>
      <span v-for="offer in offers" :key="offer.supplierId" class="small offer-line">
        <span>{{ catalogue.supplierName(offer.supplierId) }}</span>
        <span>{{ formatPence(offer.pricePence) }} <PriceAge :offer="offer" /></span>
      </span>
    </RouterLink>
  </section>
</template>

<style scoped>
.shop-link {
  margin: 8px 0 16px;
}

.price-row {
  display: flex;
  min-height: var(--tap);
  flex-direction: column;
  gap: 2px;
  color: var(--ink);
  text-decoration: none;
}

.offer-line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.refused {
  border-color: var(--bad);
}
</style>
