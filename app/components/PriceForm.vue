<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { chooseSupplier, formatPence, parsePounds, resolveOffers } from '@engine'
import type { Flower } from '@engine'

import { DEFAULT_SETTINGS, isBigChange } from '../pricing'
import { useCatalogueStore } from '../stores/catalogue'
import { usePricesStore } from '../stores/prices'

const props = defineProps<{ flower: Flower; supplierId?: string }>()
const emit = defineEmits<{ saved: [supplierId: string] }>()

const catalogue = useCatalogueStore()
const prices = usePricesStore()

const activeSuppliers = computed(() => catalogue.suppliers.filter((item) => item.active))

function offers() {
  return resolveOffers(
    props.flower,
    catalogue.activePrices,
    DEFAULT_SETTINGS,
    new Date().toISOString(),
  )
}

function offerAt(supplierId: string) {
  return offers().offers.find((offer) => offer.supplierId === supplierId)
}

function startingSupplier(): string {
  const best = chooseSupplier(props.flower.soldAs, 1, offers()).offer
  return props.supplierId ?? best?.supplierId ?? activeSuppliers.value[0]?.id ?? ''
}

const supplier = ref(startingSupplier())
const price = ref('')
const stems = ref('')
const note = ref('')
const offerEnds = ref('')
const priceError = ref('')
const stemsError = ref('')

const soldByBunch = computed(() => props.flower.soldAs === 'bunch')

function prefill() {
  const offer = offerAt(supplier.value)
  price.value = offer ? formatPence(offer.pricePence).replace(/[£,]/g, '') : ''
  stems.value = offer ? String(offer.bunchSize) : ''
}

prefill()
watch(supplier, prefill)

function submit() {
  const pricePence = parsePounds(price.value)
  const stemsPerBunch = soldByBunch.value ? Number(stems.value) : 1

  priceError.value = pricePence === null ? 'Enter the price in pounds, like 7.50.' : ''
  stemsError.value =
    Number.isInteger(stemsPerBunch) && stemsPerBunch >= 1
      ? ''
      : 'Enter how many stems are in a bunch.'
  if (pricePence === null || stemsError.value) return

  const before = offerAt(supplier.value)?.pricePence
  if (
    before !== undefined &&
    isBigChange(before, pricePence, DEFAULT_SETTINGS.bigChangePercent) &&
    !window.confirm(`Was ${formatPence(before)}, now ${formatPence(pricePence)}. Is that right?`)
  ) {
    return
  }

  void prices.report({
    flowerId: props.flower.id,
    supplierId: supplier.value,
    pricePence,
    stemsPerBunch,
    ...(note.value.trim() && { note: note.value.trim() }),
    ...(offerEnds.value && { offerEndsAt: `${offerEnds.value}T23:59:59.999Z` }),
  })
  emit('saved', supplier.value)
}
</script>

<template>
  <form class="card" novalidate @submit.prevent="submit">
    <h2 class="form-title">Update the price</h2>
    <label class="field">
      <span class="field-label">Supplier</span>
      <select v-model="supplier" name="supplier">
        <option v-for="item in activeSuppliers" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </select>
    </label>
    <label class="field">
      <span class="field-label">{{ soldByBunch ? 'Price per bunch' : 'Price per stem' }}</span>
      <input v-model="price" name="price" type="text" inputmode="decimal" autocomplete="off" />
      <span v-if="priceError" class="error" role="alert">{{ priceError }}</span>
    </label>
    <label v-if="soldByBunch" class="field">
      <span class="field-label">Stems per bunch</span>
      <input v-model="stems" name="stems" type="text" inputmode="numeric" autocomplete="off" />
      <span v-if="stemsError" class="error" role="alert">{{ stemsError }}</span>
    </label>
    <label class="field">
      <span class="field-label">Note (optional)</span>
      <input v-model="note" name="note" type="text" autocomplete="off" />
    </label>
    <label class="field">
      <span class="field-label">Offer ends (optional)</span>
      <input v-model="offerEnds" name="offer-ends" type="date" />
    </label>
    <button class="button button-primary" type="submit">Save price</button>
  </form>
</template>

<style scoped>
.form-title {
  margin-top: 0;
}
</style>
