<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import FlowerMatrix from '../components/FlowerMatrix.vue'
import LeftoverPoolCard from '../components/LeftoverPoolCard.vue'
import WorkPlanCard from '../components/WorkPlanCard.vue'
import { matrixContent, poolContent, workCardContent } from '../print/content'
import { sharePdf, sharesPdf } from '../print/sharePdf'
import { workPlanPdf } from '../print/workPlanPdf'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'

/** Long enough for a phone to open its print screen, and short enough to still feel like a reply. */
const PRINT_WAIT_MS = 1500
const PRINT_HELP =
  "If no print screen opened, press Save as PDF again, or use Print in your browser's menu."
const SHARE_HELP = "The PDF couldn't be opened. Please try again."

const store = useEventStore()
const catalogue = useCatalogueStore()

const showMatrix = ref(false)
const onePerPage = ref(false)

const pools = computed(() => store.allocation?.leftoverPools ?? [])

const opening = ref(false)
const printHelp = ref('')
let printOpened = false
let printTimer: ReturnType<typeof setTimeout> | undefined

function onBeforePrint() {
  printOpened = true
  opening.value = false
  printHelp.value = ''
  clearTimeout(printTimer)
}

onMounted(() => window.addEventListener('beforeprint', onBeforePrint))
onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', onBeforePrint)
  clearTimeout(printTimer)
})

function showPrintHelp() {
  opening.value = false
  printHelp.value = PRINT_HELP
}

function currentPdf(): string {
  return workPlanPdf({
    cards: store.workPlan.map((card) => workCardContent(card, catalogue)),
    pools: pools.value.map((pool) => poolContent(pool, catalogue)),
    matrix: showMatrix.value
      ? matrixContent(store.workPlan, catalogue, store.designLabel)
      : undefined,
    onePerPage: onePerPage.value,
  })
}

async function shareCurrentPdf() {
  opening.value = true
  try {
    await sharePdf(currentPdf())
  } catch (error) {
    const closed = error instanceof DOMException && error.name === 'AbortError'
    if (!closed) printHelp.value = SHARE_HELP
  } finally {
    opening.value = false
  }
}

/** Some browsers ignore window.print() without an error, so silence counts as a failure. */
function printPage() {
  printOpened = false
  opening.value = true
  try {
    window.print()
  } catch {
    showPrintHelp()
    return
  }
  if (!printOpened) printTimer = setTimeout(showPrintHelp, PRINT_WAIT_MS)
}

function savePdf() {
  printHelp.value = ''
  if (sharesPdf()) void shareCurrentPdf()
  else printPage()
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
          {{ printHelp }}
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
