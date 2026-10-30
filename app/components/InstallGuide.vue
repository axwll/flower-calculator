<script setup lang="ts">
import { computed } from 'vue'

import { useInstallStore } from '../stores/install'

const props = defineProps<{ dismissible?: boolean }>()

const install = useInstallStore()

const showing = computed(() => {
  if (install.help === 'none' || install.help === 'installed') return false
  return !(props.dismissible && install.dismissed)
})
</script>

<template>
  <div v-if="showing" class="card" data-install-guide>
    <h3>Add this app to your phone</h3>
    <p class="muted small">It then works offline, and your events are much safer.</p>

    <ol v-if="install.help === 'iphone'" class="steps-list">
      <li>Open this page in Safari.</li>
      <li>Tap the <strong>Share</strong> button.</li>
      <li>Tap <strong>Add to Home Screen</strong>.</li>
      <li>Tap <strong>Add</strong>, then open the app from its new icon.</li>
    </ol>

    <button
      v-else-if="install.help === 'prompt'"
      class="button button-primary install-app"
      type="button"
      @click="install.install"
    >
      Install app
    </button>

    <p v-else>Open your browser menu, then tap <strong>Install app</strong>.</p>

    <button
      v-if="dismissible"
      class="button button-quiet dismiss-install"
      type="button"
      @click="install.dismiss"
    >
      Not now
    </button>
  </div>
</template>

<style scoped>
.steps-list {
  margin: 8px 0;
  padding-left: 22px;
}

.steps-list li {
  margin-bottom: 4px;
}
</style>
