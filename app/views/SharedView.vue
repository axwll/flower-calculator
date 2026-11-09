<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { formatPence } from '@engine'
import type { EventPlan } from '@engine'

import BackLink from '../components/BackLink.vue'
import { openShared, shareIdFrom } from '../share/share'
import { useEventStore } from '../stores/event'
import { useInstallStore } from '../stores/install'
import { dayText, plural } from '../wording'

const route = useRoute()
const router = useRouter()
const store = useEventStore()
const install = useInstallStore()

const pasted = ref('')
const pasteProblem = ref('')
const loading = ref(false)
const plan = ref<EventPlan | null>(null)
const problem = ref('')
const canRetry = ref(false)

const shareId = computed(() => String(route.params.shareId ?? ''))
const existing = computed(() => store.events.find((event) => event.sharedFrom === shareId.value))
const placements = computed(
  () =>
    plan.value?.designs
      .filter((design) => design.enabled)
      .reduce((sum, design) => sum + design.quantity, 0) ?? 0,
)

async function load() {
  plan.value = null
  problem.value = ''
  canRetry.value = false
  if (!shareId.value) return

  loading.value = true
  await store.whenReady()
  const result = await openShared(shareId.value)
  loading.value = false

  if (result.status === 'ok') plan.value = result.plan
  else {
    problem.value = result.message
    canRetry.value = result.status === 'retry'
  }
}

watch(shareId, load, { immediate: true })

function submitLink() {
  const id = shareIdFrom(pasted.value)
  pasteProblem.value = id ? '' : "That doesn't look like a shared link."
  if (id) void router.push(`/shared/${id}`)
}

const canPaste = typeof navigator.clipboard?.readText === 'function'

/** A link copied on a Mac reaches an iPad's clipboard by itself, so one tap opens it. */
async function pasteLink() {
  try {
    pasted.value = await navigator.clipboard.readText()
  } catch {
    pasteProblem.value = 'Press and hold in the box, then tap Paste.'
    return
  }
  submitLink()
}

function add() {
  if (!plan.value) return
  const id = store.addShared(plan.value, shareId.value)
  store.open(id)
  void router.push(`/events/${id}/review`)
}
</script>

<template>
  <section class="page">
    <BackLink to="/events" label="Events" />
    <template v-if="!shareId">
      <h1>Open a shared link</h1>
      <form class="card" novalidate @submit.prevent="submitLink">
        <label class="field">
          <span class="field-label">Paste the link</span>
          <input v-model="pasted" name="shared-link" type="text" autocomplete="off" />
          <span v-if="pasteProblem" class="error" role="alert">{{ pasteProblem }}</span>
        </label>
        <div class="row">
          <button
            v-if="canPaste"
            class="button button-primary paste-link"
            type="button"
            @click="pasteLink"
          >
            Paste and open
          </button>
          <button class="button" :class="{ 'button-primary': !canPaste }" type="submit">
            Open
          </button>
        </div>
      </form>
    </template>

    <template v-else>
      <h1>Shared plan</h1>
      <p v-if="loading" class="muted" role="status">Loading…</p>

      <template v-if="problem">
        <p class="error" role="alert">{{ problem }}</p>
        <button v-if="canRetry" class="button retry-shared" type="button" @click="load">
          Try again
        </button>
      </template>

      <template v-if="plan">
        <div class="card" data-shared-plan>
          <h2>{{ plan.name }}</h2>
          <p v-if="plan.date" class="small">{{ plan.date }}</p>
          <p class="small muted">{{ plural(placements, 'placement') }}</p>
          <p v-if="plan.targetBudgetPence !== undefined" class="small muted">
            Budget {{ formatPence(plan.targetBudgetPence) }}
          </p>
          <template v-if="plan.purchase">
            <p class="small">
              <span class="badge">Purchased</span> {{ dayText(plan.purchase.purchasedAt) }},
              {{ formatPence(plan.purchase.allocation.totals.costPence) }}
            </p>
          </template>
        </div>

        <p v-if="install.help === 'iphone'" class="muted small" data-iphone-note>
          If you've installed the app, copy this link and paste it under Open a shared link there,
          because iPhone keeps Safari's events apart from the app's.
        </p>

        <template v-if="existing">
          <p class="small">You already have a copy of this plan.</p>
          <RouterLink class="button button-primary open-copy" :to="`/events/${existing.id}/review`">
            Open your copy
          </RouterLink>
          <button class="button button-quiet add-shared" type="button" @click="add">
            Add another copy
          </button>
        </template>
        <button v-else class="button button-primary add-shared" type="button" @click="add">
          Add to my events
        </button>
      </template>
    </template>
  </section>
</template>

<style scoped>
h2 {
  margin-top: 0;
}
</style>
