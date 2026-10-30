<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { parsePounds } from '@engine'

import { useEventStore } from '../stores/event'

const router = useRouter()
const store = useEventStore()

const name = ref('')
const date = ref('')
const budget = ref('')
const nameError = ref('')
const budgetError = ref('')

function submit() {
  const trimmedName = name.value.trim()
  const targetBudgetPence = budget.value.trim() === '' ? undefined : parsePounds(budget.value)

  nameError.value = trimmedName === '' ? 'Give the event a name.' : ''
  budgetError.value = targetBudgetPence === null ? 'Enter the budget in pounds, like 500.' : ''
  if (nameError.value || budgetError.value || targetBudgetPence === null) return

  const id = store.createEvent({
    name: trimmedName,
    ...(date.value && { date: date.value }),
    ...(targetBudgetPence !== undefined && { targetBudgetPence }),
  })
  void router.push(`/events/${id}/designs`)
}
</script>

<template>
  <section class="page">
    <h1>New event</h1>
    <form novalidate @submit.prevent="submit">
      <label class="field">
        <span class="field-label">Event name</span>
        <input v-model="name" name="name" type="text" autocomplete="off" />
        <span v-if="nameError" class="error" role="alert">{{ nameError }}</span>
      </label>
      <label class="field">
        <span class="field-label">Date (optional)</span>
        <input v-model="date" name="date" type="date" />
      </label>
      <label class="field">
        <span class="field-label">Target budget (optional)</span>
        <input v-model="budget" name="budget" type="text" inputmode="decimal" autocomplete="off" />
        <span v-if="budgetError" class="error" role="alert">{{ budgetError }}</span>
      </label>
      <button class="button button-primary" type="submit">Start blank</button>
    </form>
  </section>
</template>
