<script setup lang="ts">
import InstallGuide from '../components/InstallGuide.vue'
import { useEventStore } from '../stores/event'
import { dayText, daysUntilText } from '../wording'

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
      class="card card-link event-link"
      :to="`/events/${event.id}/designs`"
    >
      <strong>{{ event.name }}</strong>
      <span v-if="event.date" class="small" data-event-date>
        {{ dayText(event.date) }} <span class="muted">{{ daysUntilText(event.date) }}</span>
      </span>
      <span v-if="event.purchase" class="badge">Purchased</span>
    </RouterLink>
    <RouterLink class="button button-primary" to="/events/new">New event</RouterLink>
    <RouterLink class="button button-quiet" to="/shared">Open a shared link</RouterLink>
  </section>
</template>

<style scoped>
.event-link {
  flex-direction: column;
}

.event-link .badge {
  align-self: flex-start;
}
</style>
