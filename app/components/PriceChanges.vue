<script setup lang="ts">
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { priceChangeText } from '../wording'

const catalogue = useCatalogueStore()
const store = useEventStore()
</script>

<template>
  <section v-if="store.priceChanges.length > 0" class="card" data-price-changes role="status">
    <h2>Prices have changed</h2>
    <p class="muted small">Since you last looked at this event.</p>
    <p v-for="change in store.priceChanges" :key="change.flowerId" class="small">
      {{ priceChangeText(change, catalogue) }}
    </p>
    <button class="button acknowledge-prices" type="button" @click="store.acknowledgePrices">
      Got it
    </button>
  </section>
</template>

<style scoped>
h2 {
  margin-top: 0;
}
</style>
