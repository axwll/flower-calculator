<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { formatPence } from '@engine'

import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { dayText, plural } from '../wording'

const router = useRouter()
const catalogue = useCatalogueStore()
const store = useEventStore()

const justPurchased = ref(false)

const reviewPath = computed(() => `/events/${store.current?.id}/review`)
const inUse = computed(() => store.allocation?.flowers.filter(({ stems }) => stems > 0) ?? [])
const toFreeze = computed(() => inUse.value.filter(({ offer }) => offer))
const noPrice = computed(() => inUse.value.filter(({ needsData }) => needsData))

function confirm() {
  justPurchased.value = store.markPurchased()
}
</script>

<template>
  <section class="page">
    <template v-if="justPurchased">
      <h2>Purchased</h2>
      <div class="card" data-backup-nudge>
        <p>These prices are now frozen for this event.</p>
        <p class="muted small">Events are saved on this phone only, so keep a backup.</p>
        <RouterLink class="button button-primary" to="/settings">Go to backups</RouterLink>
      </div>
      <RouterLink class="button button-quiet" :to="reviewPath">Back to review</RouterLink>
    </template>

    <template v-else-if="store.current?.purchase">
      <p>This event is already purchased.</p>
      <RouterLink class="button" :to="reviewPath">Back to review</RouterLink>
    </template>

    <template v-else-if="inUse.length === 0">
      <p>Nothing to buy yet.</p>
      <RouterLink class="button" :to="reviewPath">Back to review</RouterLink>
    </template>

    <template v-else>
      <h2>Mark as purchased</h2>
      <p class="muted small">
        These prices will be frozen for this event. This can't be undone, but you can still edit the
        event afterwards.
      </p>

      <div v-if="toFreeze.length > 0" class="card">
        <div
          v-for="flower in toFreeze"
          :key="flower.flowerId"
          class="frozen-line"
          :data-frozen-price="flower.flowerId"
        >
          <div class="row">
            <strong>{{ catalogue.flowerName(flower.flowerId) }}</strong>
            <span>{{ formatPence(flower.costPence) }}</span>
          </div>
          <p class="small muted">
            {{ catalogue.supplierName(flower.offer?.supplierId ?? '') }},
            {{ formatPence(flower.offer?.pricePence ?? 0) }}
            {{ flower.soldAs === 'bunch' ? `for ${flower.offer?.bunchSize}` : 'a stem' }}
            · {{ plural(flower.stems, 'stem') }} · reported
            {{ dayText(flower.offer?.reportedAt ?? '') }}
          </p>
          <span v-if="flower.offer?.freshness === 'red'" class="badge badge-warn">Old price</span>
        </div>
      </div>

      <div v-if="noPrice.length > 0" class="card" data-no-price>
        <p>No price to freeze for these, so they'll use live prices:</p>
        <p v-for="flower in noPrice" :key="flower.flowerId" class="small">
          {{ catalogue.flowerName(flower.flowerId) }}
        </p>
      </div>

      <div class="card row">
        <strong>Estimated total</strong>
        <strong>{{ formatPence(store.allocation?.totals.costPence ?? 0) }}</strong>
      </div>

      <button class="button button-primary confirm-purchase" type="button" @click="confirm">
        Freeze these prices
      </button>
      <button
        class="button button-quiet cancel-purchase"
        type="button"
        @click="router.push(reviewPath)"
      >
        Not yet
      </button>
    </template>
  </section>
</template>

<style scoped>
.frozen-line {
  padding: 10px 0;
  border-top: 1px solid var(--line);
}

.frozen-line:first-child {
  border-top: 0;
}

.frozen-line p {
  margin: 0;
}
</style>
