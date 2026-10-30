import Dexie from 'dexie'
import type { Table } from 'dexie'

import type { EventPlan, MasterData } from '@engine'

import type { PriceStorage, QueuedAction } from './priceStorage'
import type { EventRepository } from './repository'

const MASTER_KEY = 'current'

class FlowerDatabase extends Dexie {
  events!: Table<unknown, string>
  master!: Table<{ key: string; data: MasterData }, string>
  priceQueue!: Table<QueuedAction, string>

  constructor() {
    super('flower-calculator')
    // Dexie's version covers tables and indexes. Event contents use `schemaVersion` instead.
    this.version(1).stores({ events: 'id' })
    this.version(2).stores({ events: 'id', master: 'key', priceQueue: 'id' })
  }
}

const database = new FlowerDatabase()

export function dexieRepository(): EventRepository {
  return {
    loadAll: () => database.events.toArray(),
    save: async (event: EventPlan) => {
      await database.events.put(event)
    },
  }
}

export function dexiePriceStorage(): PriceStorage {
  return {
    loadMaster: async () => (await database.master.get(MASTER_KEY))?.data ?? null,
    saveMaster: async (data) => {
      await database.master.put({ key: MASTER_KEY, data })
    },
    loadQueue: () => database.priceQueue.toArray(),
    saveQueued: async (action) => {
      await database.priceQueue.put(action)
    },
    removeQueued: (id) => database.priceQueue.delete(id),
  }
}
