<script setup lang="ts">
import { computed } from 'vue'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { plural } from '../wording'

const catalogue = useCatalogueStore()
const store = useEventStore()

const items = computed(() => store.allocation?.gatherList ?? [])

function onNote(event: Event, flowerId: string) {
  store.setGatherNote(flowerId, (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section v-if="items.length > 0" data-gather-list>
    <h2>Gather list</h2>
    <div v-for="item in items" :key="item.flowerId" class="card" :data-gather="item.flowerId">
      <div class="row">
        <strong>{{ catalogue.flowerName(item.flowerId) }}</strong>
        <span>{{ plural(item.stems, 'stem') }}</span>
      </div>
      <label class="note">
        <span class="small muted">Note (optional)</span>
        <input
          type="text"
          :value="store.current?.gatherNotes?.[item.flowerId] ?? ''"
          @change="onNote($event, item.flowerId)"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.note {
  display: block;
  margin-top: 6px;
}
</style>
