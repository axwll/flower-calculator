<script setup lang="ts">
import { computed } from 'vue'

import type { Design, PlanDesign } from '@engine'

import DesignCard from '../components/DesignCard.vue'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'

interface Card {
  design: Design
  entry: PlanDesign
  designIndex: number
}

const catalogue = useCatalogueStore()
const store = useEventStore()

const groups = computed(() => {
  const byGroup = new Map<string, Card[]>()
  store.current?.designs.forEach((entry, designIndex) => {
    const design = catalogue.designs.find((item) => item.id === entry.designId)
    if (!design) return
    byGroup.set(design.group, [
      ...(byGroup.get(design.group) ?? []),
      { design, entry, designIndex },
    ])
  })
  return [...byGroup]
})
</script>

<template>
  <section class="page has-summary">
    <template v-for="[group, cards] in groups" :key="group">
      <h2 class="group">{{ group }}</h2>
      <DesignCard
        v-for="card in cards"
        :key="card.designIndex"
        :design="card.design"
        :entry="card.entry"
        :design-index="card.designIndex"
      />
    </template>
  </section>
</template>
