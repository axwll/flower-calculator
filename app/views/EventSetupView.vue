<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { parsePounds } from '@engine'

import BackLink from '../components/BackLink.vue'
import { useEventStore } from '../stores/event'
import { groupPounds } from '../wording'

const router = useRouter()
const store = useEventStore()

const name = ref('')
const date = ref('')
const budget = ref('')
const copyFrom = ref('')
const keepFrozen = ref(false)
const nameError = ref('')
const budgetError = ref('')

const hasFrozenPrices = computed(() =>
  Boolean(store.events.find(({ id }) => id === copyFrom.value)?.frozenPrices?.length),
)

/** Rewriting the box moves the cursor, so it goes back beside the same digit. */
function onBudget(event: Event) {
  const input = event.target as HTMLInputElement
  const typed = input.value.slice(0, input.selectionStart ?? input.value.length)
  const digitsBefore = typed.replaceAll(',', '').length

  budget.value = groupPounds(input.value)
  input.value = budget.value

  let cursor = 0
  for (let seen = 0; seen < digitsBefore && cursor < input.value.length; cursor += 1) {
    if (input.value[cursor] !== ',') seen += 1
  }
  input.setSelectionRange(cursor, cursor)
}

function submit() {
  const trimmedName = name.value.trim()
  const targetBudgetPence = budget.value.trim() === '' ? undefined : parsePounds(budget.value)

  nameError.value = trimmedName === '' ? 'Give the event a name.' : ''
  budgetError.value = targetBudgetPence === null ? 'Enter the budget in pounds, like 500.' : ''
  if (nameError.value || budgetError.value || targetBudgetPence === null) return

  const details = {
    name: trimmedName,
    ...(date.value && { date: date.value }),
    ...(targetBudgetPence !== undefined && { targetBudgetPence }),
  }
  const id = copyFrom.value
    ? store.duplicateEvent(copyFrom.value, details, {
        keepFrozen: hasFrozenPrices.value && keepFrozen.value,
      })
    : store.createEvent(details)
  if (id) store.open(id)
  void router.push(`/events/${id}/designs`)
}
</script>

<template>
  <section class="page">
    <BackLink to="/events" label="Events" />
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
        <input
          :value="budget"
          name="budget"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          @input="onBudget"
        />
        <span v-if="budgetError" class="error" role="alert">{{ budgetError }}</span>
      </label>
      <label v-if="store.events.length > 0" class="field">
        <span class="field-label">Start from</span>
        <select v-model="copyFrom" name="copy-from">
          <option value="">Start blank</option>
          <option v-for="event in store.events" :key="event.id" :value="event.id">
            {{ event.name }}
          </option>
        </select>
      </label>
      <label v-if="hasFrozenPrices" class="tick">
        <input v-model="keepFrozen" name="keep-frozen" type="checkbox" />
        <span>Keep frozen prices</span>
      </label>
      <button class="button button-primary" type="submit">
        {{ copyFrom ? 'Duplicate event' : 'Start blank' }}
      </button>
    </form>
  </section>
</template>
