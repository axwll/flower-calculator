<script setup lang="ts">
import { computed } from 'vue'

import type { PlanDesign, RecipeLine } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { roleLabel } from '../wording'
import QuantityStepper from './QuantityStepper.vue'

const props = defineProps<{ design: PlanDesign; designIndex: number }>()

const catalogue = useCatalogueStore()
const store = useEventStore()

const flowerOptions = computed(() =>
  [...catalogue.flowers].sort((a, b) => a.name.localeCompare(b.name)),
)

function lineLabel(line: RecipeLine): string {
  return line.kind === 'role' ? roleLabel(line.role) : catalogue.flowerName(line.flowerId)
}

function onSwap(event: Event, lineIndex: number) {
  const flowerId = (event.target as HTMLSelectElement).value
  if (flowerId) store.swapLineForFlower(props.designIndex, lineIndex, flowerId)
}
</script>

<template>
  <div class="recipe">
    <p class="muted small">Stems for one placement. Changes apply to this event only.</p>
    <div v-for="(line, lineIndex) in design.recipe.lines" :key="lineIndex" class="recipe-line">
      <div class="row">
        <span>{{ lineLabel(line) }}</span>
        <QuantityStepper
          :model-value="line.stemsPerUnit"
          :label="lineLabel(line)"
          @update:model-value="store.setLineStems(designIndex, lineIndex, $event)"
        />
      </div>
      <label v-if="line.kind === 'role'" class="field swap">
        <span class="small muted">Use one flower instead</span>
        <select :name="`swap-${lineIndex}`" @change="onSwap($event, lineIndex)">
          <option value="">Keep as {{ lineLabel(line).toLowerCase() }}</option>
          <option v-for="flower in flowerOptions" :key="flower.id" :value="flower.id">
            {{ flower.name }}
          </option>
        </select>
      </label>
    </div>
  </div>
</template>

<style scoped>
.recipe {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.recipe-line {
  padding: 8px 0;
}

.swap {
  margin: 8px 0 0;
}
</style>
