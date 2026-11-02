<script setup lang="ts">
import { computed } from 'vue'

import { workCardContent } from '../print/content'
import { useCatalogueStore } from '../stores/catalogue'
import type { WorkPlanCard } from '../stores/event'

const props = defineProps<{ card: WorkPlanCard }>()

const catalogue = useCatalogueStore()

const content = computed(() => workCardContent(props.card, catalogue))
</script>

<template>
  <article class="card work-card" :data-work-card="card.designId">
    <div class="row">
      <h3>{{ content.name }}</h3>
      <span class="muted">{{ content.heading }}</span>
    </div>
    <p v-if="content.numbering" class="muted small">{{ content.numbering }}</p>
    <p v-if="content.warning" class="unassigned">{{ content.warning }}</p>

    <ul class="work-flowers">
      <li
        v-for="flower in content.flowers"
        :key="flower.flowerId"
        :data-work-flower="flower.flowerId"
      >
        <span>{{ flower.name }}</span>
        <strong>{{ flower.stems }}</strong>
      </li>
    </ul>

    <div v-if="content.grid" class="grid-scroll">
      <table class="grid">
        <caption class="visually-hidden">
          Stems for each placement
        </caption>
        <thead>
          <tr>
            <th scope="col">Flower</th>
            <th v-for="placement in content.grid.placements" :key="placement" scope="col">
              {{ placement }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in content.grid.rows" :key="row.flowerId" :data-grid-flower="row.flowerId">
            <th scope="row">{{ row.name }}</th>
            <td v-for="(stems, index) in row.cells" :key="index">{{ stems }}</td>
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
