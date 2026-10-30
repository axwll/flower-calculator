<script setup lang="ts">
import { computed } from 'vue'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { plural } from '../wording'

const catalogue = useCatalogueStore()
const store = useEventStore()

const flowers = computed(() => store.allocation?.flowers.filter((item) => item.spare > 0) ?? [])
const pools = computed(() => store.allocation?.leftoverPools ?? [])

function perPlacement(spare: number, quantity: number): number {
  return Math.round((spare / quantity) * 10) / 10
}
</script>

<template>
  <section v-if="flowers.length > 0" data-leftovers>
    <h2>Leftovers</h2>
    <div class="card">
      <p v-for="pool in pools" :key="pool.designIndex">
        <strong>
          {{ pool.quantity }} {{ catalogue.designName(pool.designId) }}: about
          {{ perPlacement(pool.totalSpare, pool.quantity) }} stems each
        </strong>
      </p>
      <ul class="spare-list">
        <li v-for="flower in flowers" :key="flower.flowerId">
          {{ catalogue.flowerName(flower.flowerId) }}: {{ plural(flower.spare, 'spare stem') }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.spare-list {
  margin: 0;
  padding-left: 18px;
}
</style>
