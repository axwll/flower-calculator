<script setup lang="ts">
import { computed, ref } from 'vue'

import { sharePlan } from '../share/share'
import { useEventStore } from '../stores/event'

const store = useEventStore()

const sharing = ref(false)
const link = ref('')
const problem = ref('')
const copyStatus = ref('')

const canSend = computed(() => typeof navigator.share === 'function')

async function share() {
  if (!store.current) return
  sharing.value = true
  problem.value = ''
  copyStatus.value = ''
  const plan = JSON.parse(JSON.stringify(store.current)) as typeof store.current
  const result = await sharePlan(plan)
  sharing.value = false

  if (result.status === 'shared') link.value = result.link
  else problem.value = result.message
}

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    copyStatus.value = 'Link copied.'
  } catch {
    copyStatus.value = "This phone couldn't copy it, so copy the link from the box."
  }
}

/** Closing the phone's share sheet rejects, and that's not a failure worth showing. */
async function send() {
  try {
    await navigator.share({ url: link.value })
  } catch {
    return
  }
}
</script>

<template>
  <section data-share>
    <h2>Share this plan</h2>
    <div class="card">
      <p class="muted small">
        Sends a copy. Anyone with the link can see it, including the event name, date and budget.
      </p>
      <button class="button share-plan" type="button" :disabled="sharing" @click="share">
        {{ sharing ? 'Sharing…' : 'Share this plan' }}
      </button>
      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
      <template v-if="link">
        <label class="field share-link">
          <span class="field-label">Link</span>
          <input name="share-link" type="text" readonly :value="link" />
        </label>
        <div class="row">
          <button class="button copy-link" type="button" @click="copy">Copy link</button>
          <button v-if="canSend" class="button send-link" type="button" @click="send">Send</button>
        </div>
        <p v-if="copyStatus" class="small" role="status">{{ copyStatus }}</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.share-link {
  margin-top: 16px;
}
</style>
