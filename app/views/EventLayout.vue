<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import SummaryBar from '../components/SummaryBar.vue'
import { useEventStore } from '../stores/event'

const route = useRoute()
const store = useEventStore()

const steps = computed(() => {
  const base = `/events/${String(route.params.eventId)}`
  return [
    { label: 'Designs', to: `${base}/designs` },
    { label: 'Palette', to: `${base}/palette` },
    { label: 'Review', to: `${base}/review` },
  ]
})
</script>

<template>
  <div v-if="store.current">
    <header class="event-header">
      <h1>{{ store.current.name }}</h1>
      <nav class="steps" aria-label="Steps">
        <RouterLink v-for="step in steps" :key="step.to" :to="step.to">{{ step.label }}</RouterLink>
      </nav>
    </header>
    <RouterView />
    <SummaryBar v-if="route.meta.summary" />
  </div>
</template>

<style scoped>
.event-header {
  padding: var(--gutter) var(--gutter) 0;
}

.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--card);
  overflow: hidden;
}

.steps a {
  display: flex;
  min-height: var(--tap);
  align-items: center;
  justify-content: center;
  color: var(--ink);
  text-decoration: none;
}

.steps a.router-link-active {
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 700;
}
</style>
