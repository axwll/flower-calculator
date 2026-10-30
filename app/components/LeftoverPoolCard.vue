<script setup lang="ts">
import type { LeftoverPool } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { plural } from '../wording'

defineProps<{ pool: LeftoverPool }>()

const catalogue = useCatalogueStore()
</script>

<template>
  <article class="card work-card" data-pool-card>
    <div class="row">
      <h3>{{ catalogue.designName(pool.designId) }}</h3>
      <span class="muted">× {{ pool.quantity }}</span>
    </div>
    <p class="muted small">Use what's left. These are the spare stems.</p>
    <ul class="spare-list">
      <li v-for="flower in pool.flowers" :key="flower.flowerId">
        {{ catalogue.flowerName(flower.flowerId) }}: {{ plural(flower.spare, 'spare stem') }}
      </li>
    </ul>
  </article>
</template>

<style scoped>
.spare-list {
  margin: 0;
  padding-left: 18px;
}
</style>
