<script setup lang="ts">
import { computed } from 'vue'

import type { LeftoverPool } from '@engine'

import { poolContent } from '../print/content'
import { useCatalogueStore } from '../stores/catalogue'

const props = defineProps<{ pool: LeftoverPool }>()

const catalogue = useCatalogueStore()

const content = computed(() => poolContent(props.pool, catalogue))
</script>

<template>
  <article class="card work-card" data-pool-card>
    <div class="row">
      <h3>{{ content.name }}</h3>
      <span class="muted">{{ content.heading }}</span>
    </div>
    <p class="muted small">{{ content.note }}</p>
    <ul class="spare-list">
      <li v-for="line in content.lines" :key="line">{{ line }}</li>
    </ul>
  </article>
</template>

<style scoped>
.spare-list {
  margin: 0;
  padding-left: 18px;
}
</style>
