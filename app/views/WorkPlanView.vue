<script setup lang="ts">
import { computed, ref } from 'vue'

import FlowerMatrix from '../components/FlowerMatrix.vue'
import LeftoverPoolCard from '../components/LeftoverPoolCard.vue'
import WorkPlanCard from '../components/WorkPlanCard.vue'
import { useEventStore } from '../stores/event'

const store = useEventStore()

const showMatrix = ref(false)
const onePerPage = ref(false)

const pools = computed(() => store.allocation?.leftoverPools ?? [])

function savePdf() {
  window.print()
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
        <button class="button button-primary save-pdf" type="button" @click="savePdf">
          Save as PDF
        </button>
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
</style>
