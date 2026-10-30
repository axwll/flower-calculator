import type { EventPlan } from '@engine'

/** Records come back as unknown, because they may be from an older version of the app. */
export interface EventRepository {
  loadAll(): Promise<unknown[]>
  save(event: EventPlan): Promise<void>
}

export function memoryRepository(initial: unknown[] = []): EventRepository {
  const records = new Map<unknown, unknown>(
    initial.map((record, index) => [(record as EventPlan).id ?? index, record]),
  )
  return {
    loadAll: async () => [...records.values()],
    save: async (event) => {
      records.set(event.id, JSON.parse(JSON.stringify(event)))
    },
  }
}

let active: EventRepository | null = null

/** Set once at start-up. Without one, events last only as long as the store. */
export function setEventRepository(repository: EventRepository | null): void {
  active = repository
}

export function eventRepository(): EventRepository {
  return active ?? memoryRepository()
}
