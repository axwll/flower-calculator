<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { Supplier } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { newId, useLibraryStore } from '../stores/library'

const route = useRoute()
const router = useRouter()
const catalogue = useCatalogueStore()
const library = useLibraryStore()

const existing = computed(() =>
  catalogue.suppliers.find((item) => item.id === String(route.params.supplierId)),
)

const name = ref('')
const type = ref<Supplier['type']>('wholesaler')
const active = ref(true)
const problem = ref('')

// Keyed on the id, so a refresh in the background can't overwrite what's being typed.
watch(
  () => existing.value?.id,
  () => {
    name.value = existing.value?.name ?? ''
    type.value = existing.value?.type ?? 'wholesaler'
    active.value = existing.value?.active ?? true
  },
  { immediate: true },
)

async function submit() {
  problem.value = name.value.trim() ? '' : 'Enter a name.'
  if (problem.value || library.saving) return

  const failed = await library.save({
    action: 'saveSupplier',
    supplier: {
      id: existing.value?.id ?? newId(name.value),
      name: name.value.trim(),
      type: type.value,
      active: active.value,
    },
  })
  if (failed) problem.value = failed
  else await router.push({ path: '/library', query: { show: 'suppliers' } })
}
</script>

<template>
  <section class="page">
    <h1>{{ existing ? 'Edit supplier' : 'Add a supplier' }}</h1>

    <form class="card" novalidate @submit.prevent="submit">
      <label class="field">
        <span class="field-label">Name</span>
        <input v-model="name" name="name" type="text" autocomplete="off" />
      </label>
      <label class="field">
        <span class="field-label">Type</span>
        <select v-model="type" name="type">
          <option value="wholesaler">Wholesaler</option>
          <option value="supermarket">Supermarket</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="tick">
        <input v-model="active" type="checkbox" name="active" />
        <span>In use</span>
      </label>
      <p class="muted small">Prices from a supplier that isn't in use are no longer applied.</p>

      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
      <button class="button button-primary" type="submit" :disabled="library.saving">
        {{ library.saving ? 'Saving…' : 'Save supplier' }}
      </button>
    </form>
  </section>
</template>
