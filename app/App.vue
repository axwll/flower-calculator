<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useCatalogueStore } from './stores/catalogue'
import { useEventStore } from './stores/event'
import { useInstallStore } from './stores/install'
import { usePricesStore } from './stores/prices'
import { plural } from './wording'

const route = useRoute()
const store = useEventStore()

const prices = usePricesStore()
void useCatalogueStore().start().then(prices.start)

// Created here because the browser's install prompt can fire before any screen needs it.
useInstallStore()

const storageProblem = computed(() => {
  if (store.saveFailed) return "Changes aren't being saved on this device."
  if (store.loadFailed) return "Saved events couldn't be loaded."
  if (store.unreadableEvents > 0) {
    return `${plural(store.unreadableEvents, 'event')} couldn't be opened.`
  }
  return ''
})

const tabs = [
  { label: 'Events', to: '/events' },
  { label: 'Prices', to: '/prices' },
  { label: 'Library', to: '/library' },
  { label: 'Settings', to: '/settings' },
]

/** By path, because event pages are not child routes of /events. */
function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <p v-if="storageProblem" class="storage-problem no-print" role="alert" data-storage-problem>
    {{ storageProblem }}
  </p>
  <main class="app-main">
    <RouterView />
  </main>
  <nav class="tabs" aria-label="Main">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      :class="{ 'tab-active': isActive(tab.to) }"
      :aria-current="isActive(tab.to) ? 'page' : undefined"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
