<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { Flower, Role, SoldAs } from '@engine'

import BackLink from '../components/BackLink.vue'
import { useCatalogueStore } from '../stores/catalogue'
import { newId, useLibraryStore } from '../stores/library'
import { useUnsavedChanges } from '../unsaved'
import { ROLES, roleLabel } from '../wording'

const route = useRoute()
const router = useRouter()
const catalogue = useCatalogueStore()
const library = useLibraryStore()

const flowerId = computed(() => String(route.params.flowerId))
const existing = computed(() => catalogue.flowers.find((item) => item.id === flowerId.value))

const name = ref('')
const colour = ref('')
const roles = ref<Role[]>([])
const soldAs = ref<SoldAs>('bunch')
const trackLeftovers = ref(true)
const active = ref(true)
const problem = ref('')

const { changed, markSaved } = useUnsavedChanges(() => [
  name.value,
  colour.value,
  [...roles.value].sort(),
  soldAs.value,
  trackLeftovers.value,
  active.value,
])

// Keyed on the id, so a refresh in the background can't overwrite what's being typed.
watch(
  () => existing.value?.id,
  () => {
    name.value = existing.value?.name ?? ''
    colour.value = existing.value?.colour ?? ''
    roles.value = [...(existing.value?.roles ?? [])]
    soldAs.value = existing.value?.soldAs ?? 'bunch'
    trackLeftovers.value = existing.value?.trackLeftovers ?? true
    active.value = existing.value?.active ?? true
    markSaved()
  },
  { immediate: true },
)

const soldAsChanged = computed(() => existing.value && existing.value.soldAs !== soldAs.value)
const needsPrice = computed(
  () =>
    existing.value &&
    existing.value.soldAs !== 'foraged' &&
    !catalogue.activePrices.some(
      (price) => price.flowerId === flowerId.value && price.status === 'active',
    ),
)

async function submit() {
  problem.value = ''
  if (!name.value.trim()) problem.value = 'Enter a name.'
  else if (roles.value.length === 0) problem.value = 'Choose at least one role.'
  if (problem.value || library.saving) return

  const flower: Flower = {
    id: existing.value?.id ?? newId(name.value),
    name: name.value.trim(),
    roles: roles.value,
    soldAs: soldAs.value,
    trackLeftovers: trackLeftovers.value,
    active: active.value,
    ...(colour.value.trim() ? { colour: colour.value.trim() } : {}),
  }
  const failed = await library.save({ action: 'saveFlower', flower })
  if (failed) {
    problem.value = failed
    return
  }
  markSaved()
  await router.push({ path: '/library', query: { show: 'flowers' } })
}
</script>

<template>
  <section class="page">
    <BackLink :to="{ path: '/library', query: { show: 'flowers' } }" label="Library" />
    <h1>{{ existing ? 'Edit flower' : 'Add a flower' }}</h1>
    <p v-if="needsPrice" class="small">
      No price yet, so this shows as needs data.
      <RouterLink :to="`/prices/${existing?.id}?from=library`">Add a price</RouterLink>
    </p>

    <form class="card" novalidate @submit.prevent="submit">
      <label class="field">
        <span class="field-label">Name</span>
        <input v-model="name" name="name" type="text" autocomplete="off" />
      </label>
      <label class="field">
        <span class="field-label">Colour (optional)</span>
        <input v-model="colour" name="colour" type="text" autocomplete="off" />
      </label>

      <fieldset class="field choices">
        <legend class="field-label">Roles</legend>
        <label v-for="role in ROLES" :key="role" class="tick">
          <input v-model="roles" type="checkbox" name="roles" :value="role" />
          <span>{{ roleLabel(role) }}</span>
        </label>
      </fieldset>

      <label class="field">
        <span class="field-label">Sold as</span>
        <select v-model="soldAs" name="sold-as">
          <option value="bunch">Bunch</option>
          <option value="stem">Stem</option>
          <option value="foraged">Foraged</option>
        </select>
      </label>
      <p v-if="soldAsChanged" class="badge badge-warn">Existing prices may need updating.</p>

      <label class="tick">
        <input v-model="trackLeftovers" type="checkbox" name="track-leftovers" />
        <span>Warn about thin bunches</span>
      </label>
      <label class="tick">
        <input v-model="active" type="checkbox" name="active" />
        <span>In use</span>
      </label>
      <p class="muted small">
        A flower that isn't in use stays in existing events, but can't be picked for new work.
      </p>

      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
      <button class="button button-primary" type="submit" :disabled="library.saving || !changed">
        {{ library.saving ? 'Saving…' : 'Save flower' }}
      </button>
    </form>
  </section>
</template>
