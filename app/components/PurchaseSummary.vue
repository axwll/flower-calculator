<script setup lang="ts">
import { computed } from 'vue'

import { formatPence } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { dayText, purchaseChangeText } from '../wording'

const catalogue = useCatalogueStore()
const store = useEventStore()

const purchase = computed(() => store.current?.purchase)
</script>

<template>
  <section v-if="purchase" class="card" data-purchase-summary>
    <div class="row">
      <strong>Spent at purchase</strong>
      <strong>{{ formatPence(purchase.allocation.totals.costPence) }}</strong>
    </div>
    <p class="muted small">Purchased {{ dayText(purchase.purchasedAt) }}. Prices are frozen.</p>
    <div v-if="store.addedCostPence > 0" class="row" data-added-cost>
      <span>Added after purchase</span>
      <span>{{ formatPence(store.addedCostPence) }}</span>
    </div>
    <div v-if="store.purchaseChanges.length > 0" data-purchase-changes>
      <p v-for="change in store.purchaseChanges" :key="change.flowerId" class="small">
        {{ purchaseChangeText(change, catalogue) }}
      </p>
    </div>
  </section>
</template>
