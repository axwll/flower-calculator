<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { formatPence, resolveOffers } from '@engine'

import BackLink from '../components/BackLink.vue'
import PriceAge from '../components/PriceAge.vue'
import PriceForm from '../components/PriceForm.vue'
import { useCatalogueStore } from '../stores/catalogue'
import { useConfirmStore } from '../stores/confirm'
import { usePricesStore } from '../stores/prices'
import { useThresholdsStore } from '../stores/thresholds'

const HISTORY_LENGTH = 10

const route = useRoute()
const router = useRouter()
const catalogue = useCatalogueStore()
const confirm = useConfirmStore()
const prices = usePricesStore()
const thresholds = useThresholdsStore()

const flower = computed(() =>
  catalogue.flowers.find((item) => item.id === String(route.params.flowerId)),
)
const supplierId = computed(() =>
  typeof route.query.supplier === 'string' ? route.query.supplier : undefined,
)

const offers = computed(() =>
  flower.value
    ? resolveOffers(
        flower.value,
        catalogue.activePrices,
        thresholds.settings,
        new Date().toISOString(),
      ).offers
    : [],
)

const history = computed(() =>
  catalogue.activePrices
    .filter((price) => price.flowerId === flower.value?.id && price.status === 'active')
    .sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt))
    .slice(0, HISTORY_LENGTH),
)

/** The way back depends on where the person came from. */
const parent = computed(() => {
  if (route.query.from === 'library') {
    return { to: `/library/flowers/${String(route.params.flowerId)}`, label: 'flower' }
  }
  if (route.query.from === 'shop') {
    const query = supplierId.value ? { supplier: supplierId.value } : {}
    return { to: { path: '/prices/shop', query }, label: 'Shop mode' }
  }
  return { to: '/prices', label: 'Prices' }
})

function onSaved(savedSupplierId: string) {
  void router.push(
    route.query.from === 'shop' ? `/prices/shop?supplier=${savedSupplierId}` : parent.value.to,
  )
}

async function voidReport(reportId: string) {
  const question = 'Void this price? The one before it comes back.'
  if (await confirm.ask(question, { yes: 'Void', no: 'Keep it' })) {
    void prices.voidReport(reportId)
  }
}
</script>

<template>
  <section class="page">
    <BackLink :to="parent.to" :label="parent.label" />
    <template v-if="flower">
      <h1>{{ flower.name }}</h1>

      <div v-if="offers.length > 0" class="card" data-current-offer>
        <div v-for="offer in offers" :key="offer.supplierId" class="row">
          <span>{{ catalogue.supplierName(offer.supplierId) }}</span>
          <span>{{ formatPence(offer.pricePence) }} <PriceAge :offer="offer" /></span>
        </div>
      </div>

      <p v-if="flower.soldAs === 'foraged'" class="muted">Foraged flowers have no price.</p>
      <p v-else-if="!prices.nickname">
        Add your nickname in <RouterLink to="/settings">Settings</RouterLink> to update prices.
      </p>
      <PriceForm v-else :flower="flower" :supplier-id="supplierId" @saved="onSaved" />

      <section v-if="history.length > 0" data-report-history>
        <h2>Recent reports</h2>
        <div v-for="report in history" :key="report.id" class="card" :data-report="report.id">
          <div class="row">
            <strong>{{ formatPence(report.pricePence) }}</strong>
            <span class="muted small">{{ catalogue.supplierName(report.supplierId) }}</span>
          </div>
          <p class="muted small report-detail">
            {{ report.reportedBy }}, {{ report.reportedAt.slice(0, 10) }}
            <template v-if="report.note"> · {{ report.note }}</template>
          </p>
          <span v-if="prices.isPending(report.id)" class="badge badge-warn">Pending sync</span>
          <button
            v-if="prices.canVoid(report)"
            class="button button-quiet void-report"
            type="button"
            @click="voidReport(report.id)"
          >
            Void
          </button>
        </div>
      </section>
    </template>
    <p v-else class="muted">That flower isn't in the list.</p>
  </section>
</template>

<style scoped>
.report-detail {
  margin: 0;
}
</style>
