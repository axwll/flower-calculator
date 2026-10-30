<script setup lang="ts">
import { computed } from 'vue'

import { formatPence } from '@engine'

import { useEventStore } from '../stores/event'
import { plural } from '../wording'

const store = useEventStore()
const totals = computed(() => store.allocation?.totals)
</script>

<template>
  <aside v-if="totals" class="summary" aria-label="Event summary">
    <div class="summary-inner">
      <div>
        <strong class="cost">{{ formatPence(totals.costPence) }}</strong>
        <span class="small">estimated</span>
      </div>
      <div class="small">
        <div>{{ plural(totals.stems, 'stem') }}</div>
        <div>{{ plural(totals.spareStems, 'spare stem') }}</div>
      </div>
    </div>
    <p v-if="totals.needsDataFlowers > 0" class="small note">
      {{ plural(totals.needsDataFlowers, 'flower') }} not costed
    </p>
  </aside>
</template>

<style scoped>
.summary {
  position: fixed;
  right: 0;
  bottom: calc(var(--tabs-height) + env(safe-area-inset-bottom));
  left: 0;
  z-index: 10;
  padding: 8px var(--gutter);
  background: var(--accent);
  color: var(--on-accent);
}

.summary-inner {
  display: flex;
  max-width: 608px;
  align-items: center;
  justify-content: space-between;
  margin: 0 auto;
}

.cost {
  margin-right: 6px;
  font-size: 1.25rem;
}

.note {
  max-width: 608px;
  margin: 2px auto 0;
}
</style>
