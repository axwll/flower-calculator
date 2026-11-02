<script setup lang="ts">
import { reactive, ref } from 'vue'

import type { PlanSettings } from '@engine'

import InstallGuide from '../components/InstallGuide.vue'
import { DEFAULT_SETTINGS } from '../pricing'
import { backupFileName, buildBackup, parseBackup } from '../storage/backup'
import { useConfirmStore } from '../stores/confirm'
import { useEventStore } from '../stores/event'
import { useInstallStore } from '../stores/install'
import { useLibraryStore } from '../stores/library'
import { usePricesStore } from '../stores/prices'
import { thresholdProblem, useThresholdsStore } from '../stores/thresholds'
import { useUnsavedChanges } from '../unsaved'
import { plural } from '../wording'

const confirm = useConfirmStore()
const store = useEventStore()
const install = useInstallStore()
const prices = usePricesStore()
const library = useLibraryStore()
const thresholds = useThresholdsStore()

const nickname = ref(prices.nickname)
const adminKey = ref(prices.adminKey)

const keyStatus = ref(library.adminOn ? 'Admin on' : '')
const checking = ref(false)

const message = ref('')
const problem = ref('')

function asText(settings: PlanSettings) {
  return {
    thinBunch: String(settings.thinBunchPercent),
    priceAmber: String(settings.priceAmberDays),
    priceRed: String(settings.priceRedDays),
    bigChange: String(settings.bigChangePercent),
  }
}

const limits = reactive(asText(thresholds.settings))
const limitsProblem = ref('')
const limitsSaved = ref(false)

const { changed: limitsChanged, markSaved: markLimitsSaved } = useUnsavedChanges(() => ({
  ...limits,
}))

function whole(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text) : Number.NaN
}

function onKeyInput() {
  library.setKey(adminKey.value)
  keyStatus.value = ''
}

async function checkKey() {
  checking.value = true
  keyStatus.value = await library.checkKey()
  checking.value = false
}

function saveLimits() {
  const settings: PlanSettings = {
    thinBunchPercent: whole(limits.thinBunch),
    priceAmberDays: whole(limits.priceAmber),
    priceRedDays: whole(limits.priceRed),
    bigChangePercent: whole(limits.bigChange),
  }
  limitsProblem.value = thresholdProblem(settings) ?? ''
  limitsSaved.value = !limitsProblem.value
  if (limitsSaved.value) {
    thresholds.save(settings)
    markLimitsSaved()
  }
}

function resetLimits() {
  thresholds.save({ ...DEFAULT_SETTINGS })
  Object.assign(limits, asText(DEFAULT_SETTINGS))
  limitsProblem.value = ''
  limitsSaved.value = true
  markLimitsSaved()
}

function saveBackup() {
  const now = new Date().toISOString()
  const blob = new Blob([buildBackup(store.events, now)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName(now)
  link.click()
  URL.revokeObjectURL(url)
  problem.value = ''
  message.value = `Backup saved: ${plural(store.events.length, 'event')}.`
}

async function restoreBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  message.value = ''
  problem.value = ''

  try {
    const events = parseBackup(await file.text())
    const replacing = store.countExisting(events)
    const question = `This will replace ${plural(replacing, 'event')} on this phone. Carry on?`
    if (replacing > 0 && !(await confirm.ask(question, { yes: 'Replace' }))) return
    store.importEvents(events)
    message.value = `${plural(events.length, 'event')} restored.`
  } catch (error) {
    problem.value = error instanceof Error ? error.message : 'That file could not be read.'
  } finally {
    // Clears the picker, so choosing the same file again still fires a change.
    input.value = ''
  }
}
</script>

<template>
  <section class="page">
    <h1>Settings</h1>

    <h2>You</h2>
    <div class="card">
      <label class="field">
        <span class="field-label">Nickname</span>
        <input
          v-model="nickname"
          name="nickname"
          type="text"
          autocomplete="off"
          @input="prices.setNickname(nickname)"
        />
      </label>
      <p class="muted small">Shown beside the prices you report.</p>
      <label class="field">
        <span class="field-label">Admin key (optional)</span>
        <input
          v-model="adminKey"
          name="admin-key"
          type="password"
          autocomplete="off"
          @input="onKeyInput"
        />
      </label>
      <button class="button check-key" type="button" :disabled="checking" @click="checkKey">
        {{ checking ? 'Checking…' : 'Check key' }}
      </button>
      <p v-if="keyStatus" class="small key-status" role="status">{{ keyStatus }}</p>
    </div>

    <h2>Thresholds</h2>
    <form class="card thresholds" novalidate @submit.prevent="saveLimits">
      <p class="muted small">New events copy these. Existing events keep their own.</p>
      <label class="field">
        <span class="field-label">Thin-bunch warning (%)</span>
        <input v-model="limits.thinBunch" name="thin-bunch" type="text" inputmode="numeric" />
      </label>
      <label class="field">
        <span class="field-label">Price turns amber after (days)</span>
        <input v-model="limits.priceAmber" name="price-amber" type="text" inputmode="numeric" />
      </label>
      <label class="field">
        <span class="field-label">Price turns red after (days)</span>
        <input v-model="limits.priceRed" name="price-red" type="text" inputmode="numeric" />
      </label>
      <label class="field">
        <span class="field-label">Check price changes over (%)</span>
        <input v-model="limits.bigChange" name="big-change" type="text" inputmode="numeric" />
      </label>
      <p v-if="limitsProblem" class="error" role="alert">{{ limitsProblem }}</p>
      <p v-if="limitsSaved" class="small" role="status">Thresholds saved.</p>
      <div class="row">
        <button class="button button-primary" type="submit" :disabled="!limitsChanged">
          Save thresholds
        </button>
        <button class="button button-quiet reset-thresholds" type="button" @click="resetLimits">
          Use the defaults
        </button>
      </div>
    </form>

    <h2>Backups</h2>
    <div class="card">
      <p class="muted small">
        Events are saved on this phone only. A backup is one file you can keep somewhere safe.
      </p>
      <button
        class="button button-primary export-backup"
        type="button"
        :disabled="store.events.length === 0"
        @click="saveBackup"
      >
        Export all events
      </button>
      <label class="field restore">
        <span class="field-label">Restore from a backup</span>
        <input type="file" accept="application/json,.json" @change="restoreBackup" />
      </label>
      <p v-if="message" class="small" role="status">{{ message }}</p>
      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
    </div>

    <h2>This phone</h2>
    <p v-if="install.storageStatus === 'kept'" data-storage-status>
      This phone will keep your events.
    </p>
    <p v-else-if="install.storageStatus === 'may-clear'" data-storage-status>
      This phone may clear your events if it runs out of space, so keep a backup.
    </p>
    <p v-if="install.help === 'installed'" class="muted">The app is installed.</p>
    <InstallGuide />
  </section>
</template>

<style scoped>
.restore {
  margin: 16px 0 0;
}

.restore input {
  min-height: var(--tap);
}
</style>
