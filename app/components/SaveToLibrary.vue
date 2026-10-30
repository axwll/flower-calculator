<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { newDesignFrom, useLibraryStore } from '../stores/library'

const props = defineProps<{ designIndex: number }>()

const catalogue = useCatalogueStore()
const store = useEventStore()
const library = useLibraryStore()

const open = ref(false)
const name = ref('')
const problem = ref('')
const done = ref('')

const entry = computed(() => store.current?.designs[props.designIndex])
const design = computed(() => catalogue.designs.find(({ id }) => id === entry.value?.designId))

function readyDraft() {
  problem.value = ''
  done.value = ''
  const draft = store.libraryDraft(props.designIndex)
  if (draft && draft.lines.length > 0) return draft
  problem.value = 'The recipe needs at least one line with stems.'
  return null
}

async function updateRecipe() {
  const recipe = readyDraft()
  if (!recipe) return
  const failed = await library.save({ action: 'saveRecipe', recipe })
  if (failed) problem.value = failed
  else done.value = 'Saved. New events will use this recipe.'
}

async function saveNew() {
  const draft = readyDraft()
  if (!draft || !design.value) return
  if (!name.value.trim()) {
    problem.value = 'Enter a name for the new design.'
    return
  }
  const { problem: failed } = await library.saveNewDesign(
    newDesignFrom(design.value, name.value.trim()),
    [draft],
  )
  if (failed) problem.value = failed
  else done.value = `Saved. New events will include ${name.value.trim()}.`
}
</script>

<template>
  <div class="library-save">
    <button
      v-if="!open"
      class="button button-quiet save-to-library"
      type="button"
      @click="open = true"
    >
      Save to library
    </button>
    <template v-else>
      <p class="muted small">This event stays as it is, and so do your other events.</p>
      <button
        class="button update-recipe"
        type="button"
        :disabled="library.saving"
        @click="updateRecipe"
      >
        {{ library.saving ? 'Saving…' : `Update ${design?.name} (${entry?.size})` }}
      </button>
      <label class="field new-name">
        <span class="field-label">Or save as a new design</span>
        <input v-model="name" name="new-design-name" type="text" autocomplete="off" />
      </label>
      <button
        class="button save-new-design"
        type="button"
        :disabled="library.saving"
        @click="saveNew"
      >
        Save as a new design
      </button>
      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
      <p v-if="done" class="small" role="status">{{ done }}</p>
    </template>
  </div>
</template>

<style scoped>
.library-save {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.new-name {
  margin: 12px 0 8px;
}
</style>
