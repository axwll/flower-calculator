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
const confirmingRemove = ref(false)
const change = computed(() => store.designChangeFor(props.designIndex))
/** An event keeps a size retired after it was chosen. */
const sizes = computed(() => {
  const free = store.freeSizes(props.designIndex)
  const inUse = catalogue
    .sizesFor(props.design.id)
    .filter((size) => size === props.entry.size || free.includes(size))
  return inUse.includes(props.entry.size) ? inUse : [props.entry.size, ...inUse]
})
/** Once every size is on the event a card has nothing left to switch to, but still names its own. */
const showSize = computed(
  () => sizes.value.length > 1 || catalogue.sizesFor(props.design.id).length > 1,
)
const canAddSize = computed(() => store.freeSizes(props.designIndex).length > 0)
const canRemoveSize = computed(
  () =>
    (store.current?.designs.filter(({ designId }) => designId === props.design.id).length ?? 0) > 1,
)

function onSize(event: Event) {
  store.setSize(props.designIndex, (event.target as HTMLSelectElement).value as Size)
}

/** Asked on the card, because a browser can silently block its own pop-ups. */
function askToRemove() {
  if (props.entry.quantity > 0) confirmingRemove.value = true
  else removeSize()
}

function removeSize() {
  confirmingRemove.value = false
  store.removeSize(props.designIndex)
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
    <span v-if="change" class="badge badge-warn">
      {{ change === 'added' ? 'Added after purchase' : 'Changed after purchase' }}
    </span>

    <template v-if="entry.enabled">
      <p v-if="design.isLeftoverPool" class="muted small">
        Takes the spare stems. Review shows how many for each one.
      </p>
      <div class="row controls">
        <label v-if="showSize" class="size">
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
          {{ recipeOpen ? 'Hide stem count' : 'Show stem count' }}
        </button>
        <RecipeEditor v-if="recipeOpen" :design="entry" :design-index="designIndex" />
        <div v-if="confirmingRemove" class="remove-confirm" data-remove-confirm>
          <p class="small">Remove {{ entry.size }} {{ design.name }} and its placements?</p>
          <div class="row size-actions">
            <button class="button button-danger confirm-remove" type="button" @click="removeSize">
              Remove
            </button>
            <button
              class="button button-quiet keep-size"
              type="button"
              @click="confirmingRemove = false"
            >
              Keep it
            </button>
          </div>
        </div>
        <div v-else-if="canAddSize || canRemoveSize" class="row size-actions">
          <button
            v-if="canAddSize"
            class="button button-quiet add-size"
            type="button"
            @click="store.addSize(designIndex)"
          >
            Add another size
          </button>
          <button
            v-if="canRemoveSize"
            class="button button-quiet remove-size"
            type="button"
            @click="askToRemove"
          >
            Remove this size
          </button>
        </div>
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

.size-actions {
  flex-wrap: nowrap;
  gap: 16px;
  justify-content: flex-start;
}

.size-actions .button-quiet {
  margin: 0;
  padding-inline: 0;
}

.remove-confirm p {
  margin: 8px 0;
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
