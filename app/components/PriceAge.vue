<script setup lang="ts">
import { computed } from 'vue'

import type { Offer } from '@engine'

import { plural } from '../wording'

const props = defineProps<{ offer: Offer }>()

const label = computed(() => {
  const days = Math.floor(props.offer.ageDays)
  return days === 0 ? 'Today' : plural(days, 'day')
})
</script>

<template>
  <span class="price-age" :class="`age-${offer.freshness}`">{{ label }}</span>
</template>

<style scoped>
.price-age {
  padding: 0 6px;
  border-radius: 999px;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.age-fresh {
  color: var(--muted);
}

.age-amber {
  background: var(--warn-soft);
  color: var(--warn);
  font-weight: 600;
}

.age-red {
  background: var(--bad-soft);
  color: var(--bad);
  font-weight: 600;
}
</style>
