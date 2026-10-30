<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Flower, Role } from '@engine'

import FlowerTick from '../components/FlowerTick.vue'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { roleLabel, splitText } from '../wording'

const catalogue = useCatalogueStore()
const store = useEventStore()

const showingAll = ref(new Set<Role>())

const activeFlowers = computed(() => catalogue.flowers.filter((flower) => flower.active))

function flowersFor(role: Role): Flower[] {
  const ticked = store.current?.palette[role] ?? []
  const eligible = activeFlowers.value.filter((flower) => flower.roles.includes(role))
  const others = activeFlowers.value.filter((flower) => !flower.roles.includes(role))
  return [
    ...eligible,
    ...others.filter((flower) => showingAll.value.has(role) || ticked.includes(flower.id)),
  ]
}

function splitsFor(role: Role) {
  return store.lines
    .filter((line) => line.role === role && line.total > 0)
    .map((line) => ({
      key: `${line.designIndex}-${line.lineIndex}`,
      text: `${catalogue.designName(line.designId)}: ${splitText(line)}`,
    }))
}
</script>

<template>
  <section class="page has-summary">
    <p v-if="store.usedRoles.length === 0" class="muted">
      Add some designs first, then choose flowers for them here.
    </p>
    <section v-for="role in store.usedRoles" :key="role" class="card" :data-role="role">
      <h2 class="role-heading">{{ roleLabel(role) }}</h2>
      <ul class="splits small muted">
        <li v-for="split in splitsFor(role)" :key="split.key">{{ split.text }}</li>
      </ul>
      <FlowerTick
        v-for="flower in flowersFor(role)"
        :key="flower.id"
        :flower="flower"
        :role="role"
      />
      <button
        v-if="!showingAll.has(role)"
        class="button button-quiet show-all"
        type="button"
        @click="showingAll.add(role)"
      >
        Show all flowers
      </button>
    </section>
  </section>
</template>

<style scoped>
.role-heading {
  margin-top: 0;
}

.splits {
  margin: 0 0 8px;
  padding-left: 18px;
}
</style>
