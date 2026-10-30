<script setup lang="ts">
import { computed } from 'vue'

import { useCatalogueStore } from '../stores/catalogue'
import type { WorkPlanCard } from '../stores/event'
import { placementText, plural } from '../wording'

const props = defineProps<{ card: WorkPlanCard }>()

const catalogue = useCatalogueStore()

/** Wider than this will not fit a printed page, and the wording still covers it. */
const MAX_GRID_PLACEMENTS = 12

/** When every placement is the same, "each" says it all and a grid only adds length. */
const showGrid = computed(
  () =>
    props.card.quantity <= MAX_GRID_PLACEMENTS &&
    props.card.flowers.some((flower) => flower.ranges.length > 1),
)
const placements = computed(() => Array.from({ length: props.card.quantity }, (_, i) => i + 1))
const heading = computed(() => {
  const size = props.card.size === 'Fixed' ? '' : `${props.card.size} `
  return `${size}× ${props.card.quantity}`
})
</script>

<template>
  <article class="card work-card" :data-work-card="card.designId">
    <div class="row">
      <h3>{{ catalogue.designName(card.designId) }}</h3>
      <span class="muted">{{ heading }}</span>
    </div>
    <p v-if="card.quantity > 1" class="muted small">Number them 1 to {{ card.quantity }}.</p>
    <p v-if="card.unassignedStems > 0" class="unassigned">
      {{ plural(card.unassignedStems, 'stem') }} have no flower chosen.
    </p>

    <ul class="work-flowers">
      <li v-for="flower in card.flowers" :key="flower.flowerId" :data-work-flower="flower.flowerId">
        <span>{{ catalogue.flowerName(flower.flowerId) }}</span>
        <strong>{{ placementText(flower) }}</strong>
      </li>
    </ul>

    <div v-if="showGrid" class="grid-scroll">
      <table class="grid">
        <caption class="visually-hidden">
          Stems for each placement
        </caption>
        <thead>
          <tr>
            <th scope="col">Flower</th>
            <th v-for="placement in placements" :key="placement" scope="col">{{ placement }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="flower in card.flowers"
            :key="flower.flowerId"
            :data-grid-flower="flower.flowerId"
          >
            <th scope="row">{{ catalogue.flowerName(flower.flowerId) }}</th>
            <td v-for="(stems, index) in flower.perPlacement" :key="index">{{ stems }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>

<style scoped>
.unassigned {
  padding: 6px 10px;
  border-radius: var(--radius);
  background: var(--bad-soft);
  color: var(--bad);
  font-weight: 600;
}

.work-flowers {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.work-flowers li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-top: 1px solid var(--line);
}

.work-flowers strong {
  text-align: right;
}

.grid-scroll {
  margin-top: 8px;
  overflow-x: auto;
}

.grid {
  border-collapse: collapse;
  font-size: 0.875rem;
}

.grid th,
.grid td {
  padding: 4px 8px;
  border: 1px solid var(--line);
  text-align: center;
}

.grid tbody th {
  min-width: 120px;
  font-weight: 400;
  text-align: left;
}
</style>
