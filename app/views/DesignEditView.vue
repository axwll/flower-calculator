<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { Design, Recipe, RecipeDraft, Size } from '@engine'

import LibraryRecipeEditor from '../components/LibraryRecipeEditor.vue'
import { useCatalogueStore } from '../stores/catalogue'
import { newDesignFrom, newId, useLibraryStore } from '../stores/library'

const VARIED_SIZES: Size[] = ['Small', 'Medium', 'Large']

const route = useRoute()
const router = useRouter()
const catalogue = useCatalogueStore()
const library = useLibraryStore()

const existing = computed(() =>
  catalogue.designs.find((item) => item.id === String(route.params.designId)),
)

const name = ref('')
const group = ref('')
const optional = ref(false)
const active = ref(true)
const problem = ref('')

const selectedSize = ref<Size | undefined>(undefined)
const addingFrom = ref<Size | undefined>(undefined)
const variantOpen = ref(false)
const variantName = ref('')
const variantProblem = ref('')
const sizeProblem = ref('')

const sizes = computed(() => (existing.value ? catalogue.sizesFor(existing.value.id) : []))
const groups = computed(() => [...new Set(catalogue.designs.map((item) => item.group))])
const hasRecipes = computed(() => existing.value && !existing.value.isLeftoverPool)

const sizesToAdd = computed(() => {
  if (sizes.value.length === 0) return [...VARIED_SIZES, 'Fixed' as const]
  return sizes.value.includes('Fixed')
    ? []
    : VARIED_SIZES.filter((size) => !sizes.value.includes(size))
})

const recipe = computed(() => {
  const size = selectedSize.value
  return existing.value && size ? catalogue.recipeFor(existing.value.id, size) : undefined
})

/** A new size starts as a copy of the one showing, so nothing needs typing twice. */
const editing = computed(() => {
  const start = addingFrom.value
  return (existing.value && start && catalogue.recipeFor(existing.value.id, start)) ?? recipe.value
})

// Keyed on the id, so a refresh in the background can't overwrite what's being typed.
watch(
  () => existing.value?.id,
  () => {
    name.value = existing.value?.name ?? ''
    group.value = existing.value?.group ?? ''
    optional.value = existing.value?.optional ?? false
    active.value = existing.value?.active !== false
    selectedSize.value = sizes.value[0]
    addingFrom.value = undefined
    variantOpen.value = false
    variantName.value = ''
    variantProblem.value = ''
    sizeProblem.value = ''
    problem.value = ''
  },
  { immediate: true },
)

function pickSize(event: Event) {
  selectedSize.value = (event.target as HTMLSelectElement).value as Size
  addingFrom.value = undefined
}

function addSize(event: Event) {
  const select = event.target as HTMLSelectElement
  addingFrom.value = selectedSize.value
  selectedSize.value = select.value as Size
  select.value = ''
}

function onSaved() {
  addingFrom.value = undefined
}

async function submit() {
  problem.value = ''
  if (!name.value.trim()) problem.value = 'Enter a name.'
  else if (!group.value.trim()) problem.value = 'Enter a group.'
  if (problem.value || library.saving) return

  const design: Design = {
    id: existing.value?.id ?? newId(name.value),
    name: name.value.trim(),
    group: group.value.trim(),
    optional: optional.value,
    ...(active.value ? {} : { active: false }),
  }
  const failed = await library.save({ action: 'saveDesign', design })
  if (failed) problem.value = failed
  else if (!existing.value) await router.push(`/library/designs/${design.id}`)
}

function cancelNewSize() {
  selectedSize.value = addingFrom.value
  addingFrom.value = undefined
}

function toDraft({ designId, size, lines, excludedFlowerIds }: Recipe): RecipeDraft {
  return { designId, size, lines, ...(excludedFlowerIds ? { excludedFlowerIds } : {}) }
}

async function makeVariant() {
  const source = existing.value
  variantProblem.value = variantName.value.trim() ? '' : 'Enter a name for the variant.'
  if (!source || variantProblem.value || library.saving) return

  const drafts = sizes.value.flatMap((size) => {
    const found = catalogue.recipeFor(source.id, size)
    return found ? [toDraft(found)] : []
  })
  const { id, problem: failed } = await library.saveNewDesign(
    newDesignFrom(source, variantName.value.trim()),
    drafts,
  )
  if (failed) variantProblem.value = failed
  else await router.push(`/library/designs/${id}`)
}

async function retireSize() {
  const current = recipe.value
  if (!current || !window.confirm(`Retire ${current.size}? Existing events keep theirs.`)) return

  sizeProblem.value = ''
  const failed = await library.save({
    action: 'saveRecipe',
    recipe: { ...toDraft(current), active: false },
  })
  if (failed) sizeProblem.value = failed
  else selectedSize.value = sizes.value[0]
}
</script>

<template>
  <section class="page">
    <h1>{{ existing ? existing.name : 'Add a design' }}</h1>

    <form class="card design-form" novalidate @submit.prevent="submit">
      <label class="field">
        <span class="field-label">Name</span>
        <input v-model="name" name="name" type="text" autocomplete="off" />
      </label>
      <label class="field">
        <span class="field-label">Group</span>
        <input v-model="group" name="group" type="text" autocomplete="off" list="design-groups" />
        <datalist id="design-groups">
          <option v-for="item in groups" :key="item" :value="item" />
        </datalist>
      </label>
      <label class="tick">
        <input v-model="optional" type="checkbox" name="optional" />
        <span>Optional</span>
      </label>
      <label class="tick">
        <input v-model="active" type="checkbox" name="active" />
        <span>In use</span>
      </label>
      <p class="muted small">A design that isn't in use stays in existing events only.</p>

      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
      <button class="button button-primary" type="submit" :disabled="library.saving">
        {{ library.saving ? 'Saving…' : 'Save design' }}
      </button>
    </form>

    <template v-if="hasRecipes">
      <h2>Recipe</h2>
      <div class="row sizes">
        <label v-if="sizes.length > 0 && !addingFrom" class="size">
          <span class="field-label">Size</span>
          <select name="library-size" :value="selectedSize" @change="pickSize">
            <option v-for="size in sizes" :key="size" :value="size">{{ size }}</option>
          </select>
        </label>
        <label v-if="sizesToAdd.length > 0" class="size">
          <span class="field-label">Add a size</span>
          <select name="add-size" @change="addSize">
            <option value="">Choose…</option>
            <option v-for="size in sizesToAdd" :key="size" :value="size">{{ size }}</option>
          </select>
        </label>
      </div>

      <LibraryRecipeEditor
        v-if="existing && selectedSize"
        :key="`${existing.id}/${selectedSize}/${recipe?.version ?? 'new'}`"
        :design-id="existing.id"
        :size="selectedSize"
        :start="editing"
        @saved="onSaved"
      />
      <p v-else class="muted">Add a size to write this design's recipe.</p>

      <button
        v-if="recipe && !addingFrom && sizes.length > 1"
        class="button button-quiet"
        type="button"
        :disabled="library.saving"
        @click="retireSize"
      >
        Retire this size
      </button>

      <button
        v-if="addingFrom"
        class="button button-quiet cancel-size"
        type="button"
        @click="cancelNewSize"
      >
        Cancel this size
      </button>
      <p v-if="sizeProblem" class="error" role="alert">{{ sizeProblem }}</p>

      <h2>Variant</h2>
      <p class="muted small">
        A copy under a new name, with all its sizes, such as one with no dahlia.
      </p>
      <button
        v-if="!variantOpen"
        class="button"
        type="button"
        :disabled="sizes.length === 0"
        @click="variantOpen = true"
      >
        Make a variant
      </button>
      <div v-else class="card">
        <label class="field">
          <span class="field-label">Name of the variant</span>
          <input v-model="variantName" name="variant-name" type="text" autocomplete="off" />
        </label>
        <p v-if="variantProblem" class="error" role="alert">{{ variantProblem }}</p>
        <button
          class="button button-primary"
          type="button"
          :disabled="library.saving"
          @click="makeVariant"
        >
          {{ library.saving ? 'Saving…' : 'Copy design' }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.size {
  flex: 1 1 140px;
}

.sizes {
  align-items: flex-end;
  margin-bottom: 12px;
}
</style>
