<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Recipe, RecipeLine, Role, Size } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { useLibraryStore } from '../stores/library'
import { plural, ROLES, roleLabel } from '../wording'
import QuantityStepper from './QuantityStepper.vue'

const props = defineProps<{ designId: string; size: Size; start?: Recipe | undefined }>()
const emit = defineEmits<{ saved: [] }>()

const catalogue = useCatalogueStore()
const library = useLibraryStore()

const lines = ref<RecipeLine[]>((props.start?.lines ?? []).map((line) => ({ ...line })))
const leftOut = ref<string[]>([...(props.start?.excludedFlowerIds ?? [])])
const problem = ref('')

const flowerOptions = computed(() =>
  [...catalogue.activeFlowers].sort((a, b) => a.name.localeCompare(b.name)),
)
const totalStems = computed(() => lines.value.reduce((sum, line) => sum + line.stemsPerUnit, 0))

const usedRoles = computed(() =>
  lines.value.flatMap((line): Role[] => (line.kind === 'role' ? [line.role] : [])),
)
const canLeaveOut = computed(() =>
  flowerOptions.value.filter((flower) =>
    flower.roles.some((role) => usedRoles.value.includes(role)),
  ),
)

function lineLabel(line: RecipeLine): string {
  return line.kind === 'role' ? roleLabel(line.role) : catalogue.flowerName(line.flowerId)
}

function addLine(event: Event) {
  const select = event.target as HTMLSelectElement
  const [kind, value = ''] = select.value.split(':')
  if (kind === 'role') lines.value.push({ kind: 'role', role: value as Role, stemsPerUnit: 1 })
  if (kind === 'flower') lines.value.push({ kind: 'named', flowerId: value, stemsPerUnit: 1 })
  select.value = ''
}

async function submit() {
  problem.value = ''
  if (lines.value.length === 0) problem.value = 'A recipe needs at least one line.'
  else if (lines.value.some((line) => line.stemsPerUnit < 1)) {
    problem.value = 'Every line needs at least one stem.'
  }
  if (problem.value || library.saving) return

  const available = new Set(canLeaveOut.value.map(({ id }) => id))
  const excludedFlowerIds = leftOut.value.filter((id) => available.has(id))
  const failed = await library.save({
    action: 'saveRecipe',
    recipe: {
      designId: props.designId,
      size: props.size,
      lines: lines.value.map((line) => ({ ...line })),
      ...(excludedFlowerIds.length > 0 ? { excludedFlowerIds } : {}),
    },
  })
  if (failed) problem.value = failed
  else emit('saved')
}
</script>

<template>
  <form class="card recipe-form" novalidate @submit.prevent="submit">
    <p class="muted small">
      Stems for one placement. Existing events keep their own copy of this recipe.
    </p>

    <div v-for="(line, index) in lines" :key="index" class="row recipe-line">
      <span class="line-name">{{ lineLabel(line) }}</span>
      <QuantityStepper v-model="line.stemsPerUnit" :label="lineLabel(line)" />
      <button
        class="button button-quiet remove"
        type="button"
        :aria-label="`Remove ${lineLabel(line)}`"
        @click="lines.splice(index, 1)"
      >
        Remove
      </button>
    </div>

    <p class="recipe-total">{{ plural(totalStems, 'stem') }}</p>

    <label class="field">
      <span class="field-label">Add a line</span>
      <select name="add-line" @change="addLine">
        <option value="">Choose…</option>
        <optgroup label="Roles">
          <option v-for="role in ROLES" :key="role" :value="`role:${role}`">
            {{ roleLabel(role) }}
          </option>
        </optgroup>
        <optgroup label="Flowers">
          <option v-for="flower in flowerOptions" :key="flower.id" :value="`flower:${flower.id}`">
            {{ flower.name }}
          </option>
        </optgroup>
      </select>
    </label>

    <details v-if="canLeaveOut.length > 0" class="leave-out">
      <summary>Leave flowers out of this design</summary>
      <label v-for="flower in canLeaveOut" :key="flower.id" class="tick">
        <input v-model="leftOut" type="checkbox" name="leave-out" :value="flower.id" />
        <span>{{ flower.name }}</span>
      </label>
    </details>

    <p v-if="problem" class="error" role="alert">{{ problem }}</p>
    <button class="button button-primary" type="submit" :disabled="library.saving">
      {{ library.saving ? 'Saving…' : 'Save recipe' }}
    </button>
  </form>
</template>

<style scoped>
.recipe-line {
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}

.line-name {
  flex: 1 1 100%;
}

.remove {
  padding: 8px;
}

.recipe-total {
  margin: 8px 0 12px;
  font-weight: 600;
}

.leave-out {
  margin-bottom: 12px;
}

.leave-out summary {
  min-height: var(--tap);
  padding: 10px 0;
  cursor: pointer;
}
</style>
