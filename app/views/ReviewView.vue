<script setup lang="ts">
import { computed } from 'vue'

import { formatPence } from '@engine'

import GatherList from '../components/GatherList.vue'
import LeftoversList from '../components/LeftoversList.vue'
import NeedsDataBadge from '../components/NeedsDataBadge.vue'
import OrderLine from '../components/OrderLine.vue'
import WarningList from '../components/WarningList.vue'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { plural } from '../wording'

const catalogue = useCatalogueStore()
const store = useEventStore()

const orders = computed(() => store.allocation?.orderList ?? [])
const totals = computed(() => store.allocation?.totals)
const notCosted = computed(
  () => store.allocation?.flowers.filter((item) => item.needsData && item.stems > 0) ?? [],
)
</script>

<template>
  <section class="page">
    <h2>Order list</h2>
    <p v-if="orders.length === 0" class="muted">Nothing to order yet.</p>
    <div
      v-for="order in orders"
      :key="order.supplierId"
      class="card"
      :data-supplier="order.supplierId"
    >
      <div class="row">
        <h3>{{ catalogue.supplierName(order.supplierId) }}</h3>
        <strong>{{ formatPence(order.subtotalPence) }}</strong>
      </div>
      <OrderLine v-for="flower in order.flowers" :key="flower.flowerId" :flower="flower" />
    </div>
    <div v-if="totals" class="card row" data-grand-total>
      <strong>Estimated total</strong>
      <strong>{{ formatPence(totals.costPence) }}</strong>
    </div>

    <section v-if="notCosted.length > 0" data-not-costed>
      <h2>Not costed</h2>
      <div class="card">
        <div v-for="flower in notCosted" :key="flower.flowerId" class="row not-costed-line">
          <span>
            {{ catalogue.flowerName(flower.flowerId) }}
            <span class="muted small">{{ plural(flower.stems, 'stem') }}</span>
          </span>
          <NeedsDataBadge />
        </div>
      </div>
    </section>

    <GatherList />
    <LeftoversList />
    <WarningList />
  </section>
</template>

<style scoped>
.not-costed-line {
  min-height: var(--tap);
}

[data-supplier] > .row {
  padding-bottom: 8px;
}
</style>
