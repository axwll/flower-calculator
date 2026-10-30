<script setup lang="ts">
import { computed } from 'vue'

import { formatPence } from '@engine'
import type { Flower, Role } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import NeedsDataBadge from './NeedsDataBadge.vue'

const props = defineProps<{ flower: Flower; role: Role }>()

const catalogue = useCatalogueStore()
const store = useEventStore()

const ticked = computed(() => store.current?.palette[props.role].includes(props.flower.id) ?? false)
const offer = computed(() => store.offerFor(props.flower.id))
const shared = computed(() => store.rolesTicked(props.flower.id).length > 1)
const needsData = computed(() => props.flower.soldAs !== 'foraged' && !offer.value)

const source = computed(() => {
  if (props.flower.soldAs === 'foraged') return 'Foraged'
  if (!offer.value) return ''
  const unit = props.flower.soldAs === 'stem' ? 'per stem' : `${offer.value.bunchSize} stems`
  const supplier = catalogue.supplierName(offer.value.supplierId)
  return `${supplier} · ${unit} · ${formatPence(offer.value.pricePence)}`
})

const designsUsingRole = computed(() => {
  const seen = new Set<number>()
  return store.lines.flatMap((line) => {
    if (line.role !== props.role || line.total === 0 || seen.has(line.designIndex)) return []
    seen.add(line.designIndex)
    return [{ designIndex: line.designIndex, name: catalogue.designName(line.designId) }]
  })
})

function isUsed(designIndex: number): boolean {
  const excluded = store.current?.designs[designIndex]?.excludedFlowerIds
  return !excluded?.includes(props.flower.id)
}

function onUse(event: Event, designIndex: number) {
  const used = (event.target as HTMLInputElement).checked
  store.setFlowerUsed(designIndex, props.flower.id, used)
}
</script>

<template>
  <div class="tick" :data-flower="flower.id">
    <label class="tick-row">
      <input
        name="tick"
        type="checkbox"
        :checked="ticked"
        @change="store.togglePalette(role, flower.id)"
      />
      <span>
        {{ flower.name }}
        <span v-if="source" class="muted small source">{{ source }}</span>
      </span>
    </label>
    <p v-if="shared || needsData" class="badges">
      <span v-if="shared" class="badge">Shared: {{ store.stemsFor(flower.id) }} stems</span>
      <NeedsDataBadge v-if="needsData" />
    </p>
    <details v-if="ticked && designsUsingRole.length > 1" class="leave-out">
      <summary class="small">Leave out of a design</summary>
      <label v-for="design in designsUsingRole" :key="design.designIndex" class="tick-row small">
        <input
          :name="`use-${design.designIndex}`"
          type="checkbox"
          :checked="isUsed(design.designIndex)"
          @change="onUse($event, design.designIndex)"
        />
        <span>Use in {{ design.name }}</span>
      </label>
    </details>
  </div>
</template>

<style scoped>
.tick {
  padding: 4px 0;
  border-top: 1px solid var(--line);
}

.tick-row {
  display: flex;
  min-height: var(--tap);
  align-items: center;
  gap: 10px;
}

.tick-row input {
  width: 22px;
  height: 22px;
  flex: none;
}

.source {
  display: block;
}

.badges {
  margin: 0 0 6px 32px;
}

.leave-out {
  margin-left: 32px;
}

.leave-out summary {
  display: flex;
  min-height: var(--tap);
  align-items: center;
  color: var(--accent);
  cursor: pointer;
}
</style>
