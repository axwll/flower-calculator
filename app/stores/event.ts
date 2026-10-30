import { defineStore } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'

import { allocate, chooseSupplier, combineDesignFlowers, expandPlan, resolveOffers } from '@engine'
import type {
  AllocationResult,
  EventPlan,
  ExpandedLine,
  Flower,
  LineFlower,
  Offer,
  OfferResolution,
  PlanDesign,
  PlanSettings,
  Role,
  Size,
} from '@engine'

import { CURRENT_SCHEMA_VERSION, migrateEvent } from '../storage/migrations'
import { eventRepository } from '../storage/repository'
import { useCatalogueStore } from './catalogue'

const ROLES: Role[] = ['focal', 'secondary', 'filler', 'foliage', 'accent']

const DEFAULT_SETTINGS: PlanSettings = {
  thinBunchPercent: 15,
  priceAmberDays: 14,
  priceRedDays: 30,
  bigChangePercent: 50,
}

export interface WorkPlanCard {
  designIndex: number
  designId: string
  size: Size
  quantity: number
  flowers: LineFlower[]
  unassignedStems: number
}

export interface NewEvent {
  name: string
  date?: string
  targetBudgetPence?: number
}

/** Vue's proxies can't go into IndexedDB, and copies must share nothing with the original. */
function toPlain(event: EventPlan): EventPlan {
  return JSON.parse(JSON.stringify(event)) as EventPlan
}

/** Random, because ids must stay unique across launches now that events are saved. */
function newEventId(): string {
  const [random = 0] = crypto.getRandomValues(new Uint32Array(1))
  return `event-${Date.now().toString(36)}-${random.toString(36)}`
}

export const useEventStore = defineStore('event', () => {
  const catalogue = useCatalogueStore()

  const repository = eventRepository()

  const events = ref<EventPlan[]>([])
  const currentId = ref<string | null>(null)
  const saveFailed = ref(false)
  const loadFailed = ref(false)
  const unreadableEvents = ref(0)

  const current = computed(() => events.value.find((event) => event.id === currentId.value) ?? null)

  /** A record that can't be read stays in storage, so a later version may still rescue it. */
  async function load() {
    try {
      for (const record of await repository.loadAll()) {
        try {
          const event = migrateEvent(record)
          if (!events.value.some((item) => item.id === event.id)) events.value.push(event)
        } catch {
          unreadableEvents.value += 1
        }
      }
    } catch {
      loadFailed.value = true
    }
  }

  const loaded = load()

  function whenReady(): Promise<void> {
    return loaded
  }

  function save(event: EventPlan) {
    repository.save(toPlain(event)).then(
      () => (saveFailed.value = false),
      () => (saveFailed.value = true),
    )
  }

  // Saves straight away, so nothing is lost if a phone closes the app.
  watch(current, (event) => event && save(event), { deep: true })

  /** Reruns on every change, so screens never work out totals themselves. */
  const allocation = computed<AllocationResult | null>(() => {
    if (!current.value) return null
    return allocate({
      plan: current.value,
      flowers: catalogue.flowers,
      designs: catalogue.designs,
      prices: catalogue.activePrices,
      now: new Date().toISOString(),
    })
  })

  /** One entry per design with placements, with each flower shown once. */
  const workPlan = computed<WorkPlanCard[]>(() =>
    (allocation.value?.designs ?? []).flatMap((design) => {
      const unassignedStems = design.lines.reduce((sum, line) => sum + line.unassignedStems, 0)
      const flowers = combineDesignFlowers(design)
      if (design.quantity === 0 || (flowers.length === 0 && unassignedStems === 0)) return []
      const { designIndex, designId, size, quantity } = design
      return [{ designIndex, designId, size, quantity, flowers, unassignedStems }]
    }),
  )

  const lines = computed<ExpandedLine[]>(() =>
    current.value ? expandPlan(current.value).lines : [],
  )

  /** Roles the chosen designs actually use, in the order the role list gives them. */
  const usedRoles = computed(() =>
    ROLES.filter((role) => lines.value.some((line) => line.role === role && line.total > 0)),
  )

  /** A copy, so editing an event never changes the catalogue. */
  function planDesign(designId: string, size: Size, optional: boolean): PlanDesign | undefined {
    const recipe = catalogue.recipeFor(designId, size)
    if (!recipe) return undefined
    return {
      designId,
      size,
      quantity: 0,
      enabled: !optional,
      recipe: structuredClone(toRaw(recipe)),
      excludedFlowerIds: [],
    }
  }

  function createEvent(details: NewEvent): string {
    const id = newEventId()
    const designs = catalogue.designs.flatMap((design) => {
      const size = catalogue.defaultSize(design.id)
      return (size && planDesign(design.id, size, design.optional)) || []
    })

    const event: EventPlan = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id,
      ...details,
      designs,
      palette: { focal: [], secondary: [], filler: [], foliage: [], accent: [] },
      supplierChoice: {},
      settings: { ...DEFAULT_SETTINGS },
      gatherNotes: {},
    }
    events.value.push(event)
    save(event)
    return id
  }

  /** Copies recipes, palette and quantities. The name, date and budget are the new event's. */
  function duplicateEvent(sourceId: string, details: NewEvent): string | null {
    const source = events.value.find((event) => event.id === sourceId)
    if (!source) return null

    const { date: _date, targetBudgetPence: _budget, ...kept } = toPlain(source)
    const event: EventPlan = { ...kept, ...details, id: newEventId() }
    events.value.push(event)
    save(event)
    return event.id
  }

  function countExisting(incoming: EventPlan[]): number {
    return incoming.filter((event) => events.value.some((item) => item.id === event.id)).length
  }

  /** Adds new events and replaces same-id ones. It never removes anything. */
  function importEvents(incoming: EventPlan[]) {
    for (const event of incoming) {
      const index = events.value.findIndex((item) => item.id === event.id)
      if (index === -1) events.value.push(event)
      else events.value[index] = event
      save(event)
    }
  }

  function open(id: string): boolean {
    currentId.value = events.value.some((event) => event.id === id) ? id : null
    return currentId.value !== null
  }

  function setQuantity(designIndex: number, quantity: number) {
    const design = current.value?.designs[designIndex]
    if (design) design.quantity = Math.max(0, quantity)
  }

  function setEnabled(designIndex: number, enabled: boolean) {
    const design = current.value?.designs[designIndex]
    if (design) design.enabled = enabled
  }

  /** Takes a fresh copy of that size's recipe, so edits to the old size are replaced. */
  function setSize(designIndex: number, size: Size) {
    const design = current.value?.designs[designIndex]
    const recipe = design && catalogue.recipeFor(design.designId, size)
    if (!design || !recipe) return
    design.size = size
    design.recipe = structuredClone(toRaw(recipe))
  }

  function setLineStems(designIndex: number, lineIndex: number, stems: number) {
    const line = current.value?.designs[designIndex]?.recipe.lines[lineIndex]
    if (line) line.stemsPerUnit = Math.max(0, stems)
  }

  function swapLineForFlower(designIndex: number, lineIndex: number, flowerId: string) {
    const lines = current.value?.designs[designIndex]?.recipe.lines
    const line = lines?.[lineIndex]
    if (lines && line) {
      lines[lineIndex] = { kind: 'named', flowerId, stemsPerUnit: line.stemsPerUnit }
    }
  }

  function togglePalette(role: Role, flowerId: string) {
    const ticked = current.value?.palette[role]
    if (!ticked) return
    const index = ticked.indexOf(flowerId)
    if (index === -1) ticked.push(flowerId)
    else ticked.splice(index, 1)
  }

  function setFlowerUsed(designIndex: number, flowerId: string, used: boolean) {
    const design = current.value?.designs[designIndex]
    if (!design) return
    const others = design.excludedFlowerIds.filter((id) => id !== flowerId)
    design.excludedFlowerIds = used ? others : [...others, flowerId]
  }

  function rolesTicked(flowerId: string): Role[] {
    const palette = current.value?.palette
    if (!palette) return []
    return (Object.keys(palette) as Role[]).filter((role) => palette[role].includes(flowerId))
  }

  function stemsFor(flowerId: string): number {
    return allocation.value?.flowers.find((item) => item.flowerId === flowerId)?.stems ?? 0
  }

  function resolutionFor(flower: Flower): OfferResolution | null {
    if (!current.value) return null
    return resolveOffers(
      flower,
      catalogue.activePrices,
      current.value.settings,
      new Date().toISOString(),
    )
  }

  /** The offer in use, or for an unused flower, the one that would be chosen. */
  function offerFor(flowerId: string): Offer | null {
    const allocated = allocation.value?.flowers.find((item) => item.flowerId === flowerId)
    if (allocated?.offer) return allocated.offer

    const flower = catalogue.flowers.find((item) => item.id === flowerId)
    const resolution = flower && flower.soldAs !== 'foraged' ? resolutionFor(flower) : null
    return flower && resolution ? chooseSupplier(flower.soldAs, 1, resolution).offer : null
  }

  /** Every supplier's current offer for a flower, stale ones included. */
  function offersFor(flowerId: string): Offer[] {
    const flower = catalogue.flowers.find((item) => item.id === flowerId)
    return (flower && resolutionFor(flower)?.offers) || []
  }

  /** An empty supplier id goes back to the best price. */
  function setSupplier(flowerId: string, supplierId: string) {
    const choices = current.value?.supplierChoice
    if (!choices) return
    if (supplierId) choices[flowerId] = supplierId
    else delete choices[flowerId]
  }

  function setGatherNote(flowerId: string, note: string) {
    const event = current.value
    if (!event) return
    event.gatherNotes = { ...event.gatherNotes, [flowerId]: note }
  }

  return {
    events,
    current,
    saveFailed,
    loadFailed,
    unreadableEvents,
    whenReady,
    duplicateEvent,
    countExisting,
    importEvents,
    allocation,
    workPlan,
    lines,
    usedRoles,
    createEvent,
    open,
    togglePalette,
    setFlowerUsed,
    rolesTicked,
    stemsFor,
    offerFor,
    offersFor,
    setSupplier,
    setGatherNote,
    setQuantity,
    setEnabled,
    setSize,
    setLineStems,
    swapLineForFlower,
  }
})
