<script setup lang="ts">
import { computed } from 'vue'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { plural, warningText } from '../wording'

const catalogue = useCatalogueStore()
const store = useEventStore()

const messages = computed(() =>
  (store.allocation?.warnings ?? []).map((warning) => warningText(warning, catalogue)),
)
const missing = computed(() => store.allocation?.totals.needsDataFlowers ?? 0)
</script>

<template>
  <section data-warnings>
    <h2>Warnings</h2>
    <div class="card">
      <p v-if="messages.length === 0" class="muted">No warnings.</p>
      <p v-if="missing > 0">
        <strong>{{ plural(missing, 'flower') }} missing prices</strong>
      </p>
      <ul v-if="messages.length > 0" class="warnings">
        <li v-for="message in messages" :key="message">{{ message }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.warnings {
  margin: 0;
  padding-left: 18px;
}
</style>
