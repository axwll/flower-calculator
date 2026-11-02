import type { Design, Flower, MasterData, PriceReport, RecipeDraft, Supplier } from '@engine'

export type MasterReply =
  { status: 'ok'; data: MasterData } | { status: 'unchanged' } | { status: 'failed' }

/** `retry` means try again later. `refused` means the server said no, so retrying won't help. */
export type SendResult =
  | { status: 'sent' }
  | { status: 'retry' }
  | { status: 'refused'; message: string }
  | { status: 'not-admin'; message: string }

export type AdminEdit =
  | { action: 'saveFlower'; flower: Flower }
  | { action: 'saveSupplier'; supplier: Supplier }
  | { action: 'saveDesign'; design: Design; recipes?: RecipeDraft[] }
  | { action: 'saveRecipe'; recipe: RecipeDraft }

export type ApiAction =
  | { action: 'reportPrice'; report: PriceReport }
  | { action: 'voidPrice'; reportId: string; nickname: string; adminKey?: string }
  | { action: 'checkAdmin'; adminKey: string }
  | (AdminEdit & { adminKey: string; nickname: string })

export type ShareReply =
  { status: 'shared'; id: string } | { status: 'refused'; message: string } | { status: 'failed' }

export type SharedReply =
  { status: 'ok'; payload: string } | { status: 'not-found' } | { status: 'failed' }

export interface ApiClient {
  fetchMaster(since?: number): Promise<MasterReply>
  send(action: ApiAction): Promise<SendResult>
  sharePlan(payload: string): Promise<ShareReply>
  fetchShared(id: string): Promise<SharedReply>
}

const TIMEOUT_MS = 20_000
const MASTER_LISTS = ['flowers', 'suppliers', 'designs', 'recipes', 'prices'] as const

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  if (!response.ok) return null
  try {
    return JSON.parse(await response.text()) as Record<string, unknown>
  } catch {
    return null
  }
}

/** A bad reply must never replace good cached data. */
function isMaster(value: unknown): value is MasterData {
  const data = value as Partial<MasterData> | null | undefined
  return (
    typeof data?.version === 'number' &&
    MASTER_LISTS.every((list) => Array.isArray(data[list])) &&
    (data.flowers?.length ?? 0) > 0
  )
}

export function httpClient(url: string, key: string): ApiClient {
  function post(action: Record<string, unknown>) {
    return fetch(url, {
      method: 'POST',
      // Plain text avoids a CORS preflight, which Apps Script can't answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...action, key }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).then(readJson)
  }

  return {
    async fetchMaster(since) {
      try {
        const query = since === undefined ? '' : `?since=${since}`
        const reply = await readJson(
          await fetch(`${url}${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
        )
        if (reply?.status === 'unchanged') return { status: 'unchanged' }
        return reply?.status === 'ok' && isMaster(reply.data)
          ? { status: 'ok', data: reply.data }
          : { status: 'failed' }
      } catch {
        return { status: 'failed' }
      }
    },

    async send(action) {
      try {
        const reply = await post(action)
        if (reply?.status === 'ok') return { status: 'sent' }
        if (reply?.status !== 'error' || reply.code === 'busy') return { status: 'retry' }
        if (reply.code === 'not-admin') {
          return { status: 'not-admin', message: String(reply.message) }
        }
        return { status: 'refused', message: String(reply.message) }
      } catch {
        return { status: 'retry' }
      }
    },

    async sharePlan(payload) {
      try {
        const reply = await post({ action: 'sharePlan', payload })
        if (reply?.status === 'ok' && typeof reply.id === 'string') {
          return { status: 'shared', id: reply.id }
        }
        return reply?.status === 'error' && reply.code !== 'busy'
          ? { status: 'refused', message: String(reply.message) }
          : { status: 'failed' }
      } catch {
        return { status: 'failed' }
      }
    },

    async fetchShared(id) {
      try {
        const reply = await readJson(
          await fetch(`${url}?shared=${encodeURIComponent(id)}`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }),
        )
        if (reply?.code === 'not-found') return { status: 'not-found' }
        return reply?.status === 'ok' && typeof reply.payload === 'string'
          ? { status: 'ok', payload: reply.payload }
          : { status: 'failed' }
      } catch {
        return { status: 'failed' }
      }
    },
  }
}

export const offlineClient: ApiClient = {
  fetchMaster: async () => ({ status: 'failed' }),
  send: async () => ({ status: 'retry' }),
  sharePlan: async () => ({ status: 'failed' }),
  fetchShared: async () => ({ status: 'failed' }),
}

let active: ApiClient | null = null

/** Set once at start-up. Without one, the app behaves as if it had no connection. */
export function setApiClient(client: ApiClient | null): void {
  active = client
}

export function apiClient(): ApiClient {
  return active ?? offlineClient
}
