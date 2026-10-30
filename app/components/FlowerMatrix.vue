<script setup lang="ts">
import { computed } from 'vue'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'

const catalogue = useCatalogueStore()
const store = useEventStore()

const rows = computed(() => {
  const ids = new Set(store.workPlan.flatMap((card) => card.flowers.map((item) => item.flowerId)))
  return [...ids]
    .map((flowerId) => {
      const cells = store.workPlan.map(
        (card) => card.flowers.find((item) => item.flowerId === flowerId)?.stems ?? 0,
      )
      return {
        flowerId,
        name: catalogue.flowerName(flowerId),
        cells,
        total: cells.reduce((sum, stems) => sum + stems, 0),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <section class="matrix-section" data-matrix>
    <h2>Flowers by design</h2>
    <div class="matrix-scroll">
      <table class="matrix">
        <thead>
          <tr>
            <th scope="col">Flower</th>
            <th v-for="card in store.workPlan" :key="card.designIndex" scope="col">
              {{ catalogue.designName(card.designId) }}
            </th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.flowerId" :data-matrix-flower="row.flowerId">
            <th scope="row">{{ row.name }}</th>
            <td v-for="(stems, index) in row.cells" :key="index">{{ stems || '' }}</td>
            <td class="total">{{ row.total }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.matrix-scroll {
  overflow-x: auto;
}

.matrix {
  border-collapse: collapse;
  background: var(--card);
  font-size: 0.875rem;
}

.matrix th,
.matrix td {
  min-width: 56px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  text-align: center;
}

.matrix tbody th {
  min-width: 140px;
  font-weight: 400;
  text-align: left;
}

.total {
  font-weight: 700;
}
</style>
