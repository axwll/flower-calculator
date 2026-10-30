<script setup lang="ts">
import InstallGuide from '../components/InstallGuide.vue'
import { useEventStore } from '../stores/event'

const store = useEventStore()
</script>

<template>
  <section class="page">
    <h1>Events</h1>
    <InstallGuide dismissible />
    <p v-if="store.events.length === 0" class="muted">No events yet.</p>
    <RouterLink
      v-for="event in store.events"
      :key="event.id"
      class="card event-link"
      :to="`/events/${event.id}/designs`"
    >
      <strong>{{ event.name }}</strong>
      <span v-if="event.date" class="muted small">{{ event.date }}</span>
    </RouterLink>
    <RouterLink class="button button-primary" to="/events/new">New event</RouterLink>
  </section>
</template>

<style scoped>
.event-link {
  display: flex;
  min-height: var(--tap);
  flex-direction: column;
  color: var(--ink);
  text-decoration: none;
}
</style>
