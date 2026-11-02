<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import FlowerMatrix from '../components/FlowerMatrix.vue'
import LeftoverPoolCard from '../components/LeftoverPoolCard.vue'
import WorkPlanCard from '../components/WorkPlanCard.vue'
import { useEventStore } from '../stores/event'

/** Long enough for a phone to open its print screen, and short enough to still feel like a reply. */
const PRINT_WAIT_MS = 1500

const store = useEventStore()

const showMatrix = ref(false)
const onePerPage = ref(false)

const pools = computed(() => store.allocation?.leftoverPools ?? [])

const opening = ref(false)
const printHelp = ref(false)
let printOpened = false
let printTimer: ReturnType<typeof setTimeout> | undefined

function onBeforePrint() {
  printOpened = true
  opening.value = false
  clearTimeout(printTimer)
}

onMounted(() => window.addEventListener('beforeprint', onBeforePrint))
onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', onBeforePrint)
  clearTimeout(printTimer)
})

function showPrintHelp() {
  opening.value = false
  printHelp.value = true
}

/** Some phones ignore window.print() without an error, so silence counts as a failure. */
function savePdf() {
  printOpened = false
  printHelp.value = false
  opening.value = true
  try {
    window.print()
  } catch {
    showPrintHelp()
    return
  }
  if (!printOpened) printTimer = setTimeout(showPrintHelp, PRINT_WAIT_MS)
}
</script>

<template>
  <section class="page" :class="{ 'one-per-page': onePerPage }" data-work-plan>
    <h2 class="print-title">Work plan</h2>
    <p v-if="store.workPlan.length === 0" class="muted">
      Add some designs first, then the work plan appears here.
    </p>

    <template v-if="store.workPlan.length > 0">
      <div class="card print-options no-print">
        <label class="option">
          <input v-model="showMatrix" name="show-matrix" type="checkbox" />
          <span>Show flowers by design</span>
        </label>
        <label class="option">
          <input v-model="onePerPage" name="one-per-page" type="checkbox" />
          <span>One design per page</span>
        </label>
        <button
          class="button button-primary save-pdf"
          type="button"
          :disabled="opening"
          @click="savePdf"
        >
          {{ opening ? 'Opening…' : 'Save as PDF' }}
        </button>
        <p v-if="printHelp" class="small print-help" role="alert" data-print-help>
          If no print screen opened, this phone may not print from the installed app. On Review, tap
          Share this plan, open the link in your browser (Safari on iPhone), add the plan there,
          then use Save as PDF.
        </p>
      </div>

      <WorkPlanCard v-for="card in store.workPlan" :key="card.designIndex" :card="card" />
      <LeftoverPoolCard v-for="pool in pools" :key="pool.designIndex" :pool="pool" />
      <FlowerMatrix v-if="showMatrix" />
    </template>
  </section>
</template>

<style scoped>
.option {
  display: flex;
  min-height: var(--tap);
  align-items: center;
  gap: 10px;
}

.option input {
  width: 22px;
  height: 22px;
}

.print-title {
  display: none;
}

.print-help {
  margin-bottom: 0;
}
</style>
