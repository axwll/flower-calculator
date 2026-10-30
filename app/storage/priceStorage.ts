import type { MasterData, PriceReport } from '@engine'

export type QueuedAction =
  | { id: string; kind: 'report'; report: PriceReport }
  | { id: string; kind: 'void'; reportId: string; nickname: string; adminKey?: string }

export interface PriceStorage {
  loadMaster(): Promise<MasterData | null>
  saveMaster(master: MasterData): Promise<void>
  loadQueue(): Promise<QueuedAction[]>
  saveQueued(action: QueuedAction): Promise<void>
  removeQueued(id: string): Promise<void>
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function memoryPriceStorage(): PriceStorage {
  let master: MasterData | null = null
  const queue = new Map<string, QueuedAction>()
  return {
    loadMaster: async () => master,
    saveMaster: async (data) => {
      master = copy(data)
    },
    loadQueue: async () => [...queue.values()],
    saveQueued: async (action) => {
      queue.set(action.id, copy(action))
    },
    removeQueued: async (id) => {
      queue.delete(id)
    },
  }
}

let active: PriceStorage | null = null

/** Set once at start-up. Without one, nothing outlives the store. */
export function setPriceStorage(storage: PriceStorage | null): void {
  active = storage
}

export function priceStorage(): PriceStorage {
  return active ?? memoryPriceStorage()
}
