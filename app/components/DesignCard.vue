<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Design, PlanDesign, Size } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import QuantityStepper from './QuantityStepper.vue'
import RecipeEditor from './RecipeEditor.vue'

const props = defineProps<{ design: Design; entry: PlanDesign; designIndex: number }>()

const catalogue = useCatalogueStore()
const store = useEventStore()

const recipeOpen = ref(false)
const sizes = computed(() => catalogue.sizesFor(props.design.id))

function onSize(event: Event) {
  store.setSize(props.designIndex, (event.target as HTMLSelectElement).value as Size)
}

function onEnabled(event: Event) {
  store.setEnabled(props.designIndex, (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <article class="card" :data-design="design.id">
    <div class="row">
      <h3>{{ design.name }}</h3>
      <label v-if="design.optional" class="switch">
        <input type="checkbox" :checked="entry.enabled" @change="onEnabled" />
        <span>Include</span>
      </label>
    </div>

    <template v-if="entry.enabled">
      <p v-if="design.isLeftoverPool" class="muted small">
        Takes the spare stems. Review shows how many for each one.
      </p>
      <div class="row controls">
        <label v-if="sizes.length > 1" class="size">
          <span class="visually-hidden">Size of {{ design.name }}</span>
          <select name="size" :value="entry.size" @change="onSize">
            <option v-for="size in sizes" :key="size" :value="size">{{ size }}</option>
          </select>
        </label>
        <QuantityStepper
          :model-value="entry.quantity"
          :label="design.name"
          @update:model-value="store.setQuantity(designIndex, $event)"
        />
      </div>
      <template v-if="!design.isLeftoverPool">
        <button
          class="button button-quiet recipe-toggle"
          type="button"
          :aria-expanded="recipeOpen"
          @click="recipeOpen = !recipeOpen"
        >
          {{ recipeOpen ? 'Hide recipe' : 'Show recipe' }}
        </button>
        <RecipeEditor v-if="recipeOpen" :design="entry" :design-index="designIndex" />
      </template>
    </template>
  </article>
</template>

<style scoped>
.controls {
  margin-top: 8px;
}

.size {
  flex: 1 1 120px;
}

.switch {
  display: inline-flex;
  min-height: var(--tap);
  align-items: center;
  gap: 8px;
}

.switch input {
  width: 22px;
  height: 22px;
}
</style>
