<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

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
