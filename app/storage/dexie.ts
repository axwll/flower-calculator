import Dexie from 'dexie'
import type { Table } from 'dexie'

import type { EventPlan } from '@engine'

import type { EventRepository } from './repository'

class FlowerDatabase extends Dexie {
  events!: Table<unknown, string>

  constructor() {
    super('flower-calculator')
    // Dexie's version covers tables and indexes. Event contents use `schemaVersion` instead.
    this.version(1).stores({ events: 'id' })
  }
}

export function dexieRepository(): EventRepository {
  const database = new FlowerDatabase()
  return {
    loadAll: () => database.events.toArray(),
    save: async (event: EventPlan) => {
      await database.events.put(event)
    },
  }
}
