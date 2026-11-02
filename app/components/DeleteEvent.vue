<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useEventStore } from '../stores/event'

const router = useRouter()
const store = useEventStore()

const confirming = ref(false)
const deleting = ref(false)
const problem = ref('')

const warning = computed(() =>
  store.current?.purchase
    ? "This can't be undone, and its purchase record goes too. Anyone you've shared it with keeps their copy."
    : "This can't be undone. Anyone you've shared it with keeps their copy.",
)

async function confirmDelete() {
  if (!store.current) return
  deleting.value = true
  problem.value = ''
  const deleted = await store.deleteEvent(store.current.id)
  deleting.value = false

  if (deleted) await router.replace('/events')
  else problem.value = "This event couldn't be deleted. Try again."
}
</script>

<template>
  <section v-if="store.current" data-delete>
    <div v-if="confirming" class="card" data-delete-confirm>
      <p>
        <strong>Delete {{ store.current.name }}?</strong>
      </p>
      <p class="muted small">{{ warning }}</p>
      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
      <button
        class="button button-danger confirm-delete"
        type="button"
        :disabled="deleting"
        @click="confirmDelete"
      >
        {{ deleting ? 'Deleting…' : 'Delete this event' }}
      </button>
      <button class="button button-quiet keep-event" type="button" @click="confirming = false">
        Keep it
      </button>
    </div>
    <button
      v-else
      class="button button-quiet delete-event"
      type="button"
      @click="confirming = true"
    >
      Delete event
    </button>
  </section>
</template>

<style scoped>
[data-delete] {
  margin-top: 24px;
}
</style>
