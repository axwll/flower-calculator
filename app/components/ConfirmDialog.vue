<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { useConfirmStore } from '../stores/confirm'

const confirm = useConfirmStore()

const dialog = ref<HTMLElement | null>(null)

watch(
  () => confirm.request,
  async () => {
    await nextTick()
    dialog.value?.focus()
  },
)
</script>

<template>
  <div v-if="confirm.request" class="confirm-backdrop no-print">
    <div
      ref="dialog"
      class="card confirm-dialog no-print"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-message"
      tabindex="-1"
    >
      <p id="confirm-message">{{ confirm.request.message }}</p>
      <div class="row confirm-actions">
        <button
          class="button button-primary confirm-yes"
          type="button"
          @click="confirm.answer(true)"
        >
          {{ confirm.request.yes }}
        </button>
        <button class="button button-quiet confirm-no" type="button" @click="confirm.answer(false)">
          {{ confirm.request.no }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--gutter);
  padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
  background: rgb(0 0 0 / 40%);
  inset: 0;
}

.confirm-dialog {
  width: 100%;
  max-width: 480px;
  margin: 0;
  padding: 16px;
  outline: none;
}

.confirm-dialog p {
  margin: 0 0 12px;
}

.confirm-actions {
  justify-content: flex-start;
}
</style>
