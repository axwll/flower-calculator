import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { PriceReport } from '@engine'

import { apiClient } from '../api/client'
import type { ApiAction } from '../api/client'
import { readPreference, writePreference } from '../storage/preferences'
import { priceStorage } from '../storage/priceStorage'
import type { QueuedAction } from '../storage/priceStorage'
import { useCatalogueStore } from './catalogue'

const NICKNAME_KEY = 'nickname'
const ADMIN_KEY = 'admin-key'

export type PriceForm = Pick<
  PriceReport,
  'flowerId' | 'supplierId' | 'pricePence' | 'stemsPerBunch' | 'note' | 'offerEndsAt'
>

export interface RefusedAction {
  id: string
  message: string
}

/** Made on the phone, so a retry after a lost reply can't create a second report. */
function newReportId(): string {
  const [random = 0] = crypto.getRandomValues(new Uint32Array(1))
  return `report-${Date.now().toString(36)}-${random.toString(36)}`
}

function toApiAction(queued: QueuedAction): ApiAction {
  if (queued.kind === 'report') return { action: 'reportPrice', report: queued.report }
  const { reportId, nickname, adminKey } = queued
  return { action: 'voidPrice', reportId, nickname, ...(adminKey ? { adminKey } : {}) }
}

export const usePricesStore = defineStore('prices', () => {
  const catalogue = useCatalogueStore()
  const storage = priceStorage()

  const nickname = ref(readPreference(NICKNAME_KEY))
  const adminKey = ref(readPreference(ADMIN_KEY))
  const queue = ref<QueuedAction[]>([])
  const refused = ref<RefusedAction[]>([])
  let flushing = false

  function setNickname(value: string) {
    nickname.value = value.trim()
    writePreference(NICKNAME_KEY, nickname.value)
  }

  function setAdminKey(value: string) {
    adminKey.value = value.trim()
    writePreference(ADMIN_KEY, adminKey.value)
  }

  function showPending(queued: QueuedAction) {
    if (queued.kind === 'report') catalogue.pendingReports.push(queued.report)
    else catalogue.pendingVoids.push(queued.reportId)
  }

  function clearPending(queued: QueuedAction) {
    if (queued.kind === 'report') {
      catalogue.pendingReports = catalogue.pendingReports.filter(
        (report) => report.id !== queued.report.id,
      )
    } else {
      catalogue.pendingVoids = catalogue.pendingVoids.filter((id) => id !== queued.reportId)
    }
  }

  async function dequeue(queued: QueuedAction) {
    queue.value = queue.value.filter((item) => item.id !== queued.id)
    await storage.removeQueued(queued.id)
    clearPending(queued)
  }

  async function enqueue(queued: QueuedAction) {
    queue.value.push(queued)
    showPending(queued)
    await storage.saveQueued(queued)
    await flush()
  }

  /** In order, and stops at the first failure, so a later price can't overtake an earlier one. */
  async function flush() {
    if (flushing) return
    flushing = true
    let sent = false

    let queued = queue.value[0]
    while (queued) {
      const result = await apiClient().send(toApiAction(queued))
      if (result.status === 'retry') break

      if (result.status === 'sent') {
        sent = true
        if (queued.kind === 'report') catalogue.recordSent(queued.report)
        else catalogue.recordVoided(queued.reportId)
      } else {
        refused.value.push({ id: queued.id, message: result.message })
      }
      await dequeue(queued)
      queued = queue.value[0]
    }

    flushing = false
    if (sent) await catalogue.refresh()
  }

  async function report(form: PriceForm) {
    const id = newReportId()
    await enqueue({
      id,
      kind: 'report',
      report: {
        ...form,
        id,
        reportedAt: new Date().toISOString(),
        reportedBy: nickname.value,
        status: 'active',
      },
    })
  }

  async function voidReport(reportId: string) {
    const unsent = queue.value.find((item) => item.kind === 'report' && item.id === reportId)
    if (unsent) {
      await dequeue(unsent)
      return
    }

    await enqueue({
      id: `void-${reportId}`,
      kind: 'void',
      reportId,
      nickname: nickname.value,
      ...(adminKey.value ? { adminKey: adminKey.value } : {}),
    })
  }

  function isPending(reportId: string): boolean {
    return queue.value.some((item) => item.id === reportId)
  }

  function canVoid(target: Pick<PriceReport, 'reportedBy' | 'status'>): boolean {
    if (target.status !== 'active') return false
    return (
      Boolean(adminKey.value) || (nickname.value !== '' && target.reportedBy === nickname.value)
    )
  }

  function dismissRefused(id: string) {
    refused.value = refused.value.filter((item) => item.id !== id)
  }

  /** iOS has no dependable background sync, so this retries on open and when back online. */
  async function start() {
    for (const queued of await storage.loadQueue()) {
      queue.value.push(queued)
      showPending(queued)
    }
    window.addEventListener('online', () => void flush())
    await flush()
  }

  return {
    nickname,
    adminKey,
    queue,
    refused,
    setNickname,
    setAdminKey,
    report,
    voidReport,
    flush,
    isPending,
    canVoid,
    dismissRefused,
    start,
  }
})
