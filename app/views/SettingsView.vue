<script setup lang="ts">
import { ref } from 'vue'

import InstallGuide from '../components/InstallGuide.vue'
import { backupFileName, buildBackup, parseBackup } from '../storage/backup'
import { useEventStore } from '../stores/event'
import { useInstallStore } from '../stores/install'
import { plural } from '../wording'

const store = useEventStore()
const install = useInstallStore()

const message = ref('')
const problem = ref('')

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
    if (
      replacing > 0 &&
      !window.confirm(`This will replace ${plural(replacing, 'event')} on this phone. Carry on?`)
    ) {
      return
    }
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

    <p class="muted">Coming later: thresholds and nickname.</p>
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
