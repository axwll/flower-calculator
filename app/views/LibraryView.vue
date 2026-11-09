<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCatalogueStore } from '../stores/catalogue'
import { useLibraryStore } from '../stores/library'
import { plural } from '../wording'

const SECTIONS = [
  { id: 'recipes', label: 'Design types' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'suppliers', label: 'Suppliers' },
]

const route = useRoute()
const router = useRouter()
const catalogue = useCatalogueStore()
const library = useLibraryStore()

const section = computed(() => (route.query.show as string | undefined) ?? 'recipes')

const flowers = computed(() => [...catalogue.flowers].sort((a, b) => a.name.localeCompare(b.name)))

const sizesText = computed(() => (designId: string, isPool?: boolean) => {
  if (isPool) return 'Takes the spare stems'
  const count = catalogue.sizesFor(designId).length
  return count === 0 ? 'No stem count yet' : plural(count, 'size')
})

function show(id: string) {
  void router.replace({ query: { show: id } })
}
</script>

<template>
  <section class="page">
    <h1>Library</h1>

    <p v-if="!library.adminOn">
      This is where design types, flowers and suppliers are looked after. It needs the admin key,
      which goes in <RouterLink to="/settings">Settings</RouterLink>.
    </p>

    <template v-else>
      <div class="sections">
        <button
          v-for="item in SECTIONS"
          :key="item.id"
          class="button"
          :class="{ 'button-primary': section === item.id }"
          type="button"
          :aria-pressed="section === item.id"
          @click="show(item.id)"
        >
          {{ item.label }}
        </button>
      </div>

      <template v-if="section === 'recipes'">
        <RouterLink class="button button-primary add" to="/library/designs/new">
          Add a design type
        </RouterLink>
        <RouterLink
          v-for="design in catalogue.designs"
          :key="design.id"
          class="card card-link library-row"
          :data-library-design="design.id"
          :to="`/library/designs/${design.id}`"
        >
          <span>{{ design.name }}</span>
          <span class="muted small">
            <span v-if="design.active === false" class="badge badge-warn">Retired</span>
            {{ design.group }} · {{ sizesText(design.id, design.isLeftoverPool) }}
          </span>
        </RouterLink>
      </template>

      <template v-else-if="section === 'flowers'">
        <RouterLink class="button button-primary add" to="/library/flowers/new">
          Add a flower
        </RouterLink>
        <RouterLink
          v-for="flower in flowers"
          :key="flower.id"
          class="card card-link library-row"
          :data-library-flower="flower.id"
          :to="`/library/flowers/${flower.id}`"
        >
          <span>{{ flower.name }}</span>
          <span v-if="!flower.active" class="badge badge-warn">Retired</span>
        </RouterLink>
      </template>

      <template v-else>
        <RouterLink class="button button-primary add" to="/library/suppliers/new">
          Add a supplier
        </RouterLink>
        <RouterLink
          v-for="supplier in catalogue.suppliers"
          :key="supplier.id"
          class="card card-link library-row"
          :data-library-supplier="supplier.id"
          :to="`/library/suppliers/${supplier.id}`"
        >
          <span>{{ supplier.name }}</span>
          <span v-if="!supplier.active" class="badge badge-warn">Retired</span>
        </RouterLink>
      </template>
    </template>
  </section>
</template>

<style scoped>
.sections {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.sections .button {
  padding: 8px 4px;
}

.add {
  margin-bottom: 12px;
}

.library-row {
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  justify-content: space-between;
}
</style>
