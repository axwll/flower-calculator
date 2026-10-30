<script setup lang="ts">
import { computed } from 'vue'

import { formatPence } from '@engine'
import type { FlowerAllocation } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { plural } from '../wording'

const props = defineProps<{ flower: FlowerAllocation }>()

const catalogue = useCatalogueStore()
const store = useEventStore()

const offers = computed(() => store.offersFor(props.flower.flowerId))
const choice = computed(() => store.current?.supplierChoice[props.flower.flowerId] ?? '')
const thin = computed(() =>
  store.allocation?.warnings.some(
    (warning) => warning.code === 'thin-bunch' && warning.flowerId === props.flower.flowerId,
  ),
)

const buying = computed(() => {
  const { soldAs, bunches, offer } = props.flower
  return soldAs === 'bunch' && offer ? `${bunches} × ${offer.bunchSize}` : 'Sold by the stem'
})

function onSupplier(event: Event) {
  store.setSupplier(props.flower.flowerId, (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="order-line" :data-order-line="flower.flowerId">
    <div class="row line-head">
      <strong>{{ catalogue.flowerName(flower.flowerId) }}</strong>
      <span>{{ formatPence(flower.costPence) }}</span>
    </div>
    <p class="small muted line-detail">
      {{ plural(flower.stems, 'stem') }} · {{ buying }} · {{ flower.spare }} spare
    </p>
    <span v-if="thin" class="badge badge-warn">Thin bunch</span>
    <label v-if="offers.length > 1" class="supplier">
      <span class="visually-hidden">
        Supplier for {{ catalogue.flowerName(flower.flowerId) }}
      </span>
      <select :value="choice" @change="onSupplier">
        <option value="">Best price</option>
        <option v-for="offer in offers" :key="offer.supplierId" :value="offer.supplierId">
          {{ catalogue.supplierName(offer.supplierId) }}, {{ formatPence(offer.pricePence) }}
          {{ offer.freshness === 'red' ? `(old price, ${Math.floor(offer.ageDays)} days)` : '' }}
        </option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.order-line {
  padding: 10px 0;
  border-top: 1px solid var(--line);
}

.line-head {
  flex-wrap: nowrap;
  align-items: flex-start;
}

.line-detail {
  margin: 0;
}

.supplier {
  display: block;
  margin-top: 6px;
}
</style>
