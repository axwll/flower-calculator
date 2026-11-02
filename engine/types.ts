import type { AllocationResult } from './results'

export type Role = 'focal' | 'secondary' | 'filler' | 'foliage' | 'accent'
export type SoldAs = 'bunch' | 'stem' | 'foraged'
export type Size = 'Small' | 'Medium' | 'Large' | 'Fixed'

export interface Flower {
  id: string
  name: string
  colour?: string
  roles: Role[]
  soldAs: SoldAs
  /** False exempts the flower from thin-bunch warnings. */
  trackLeftovers: boolean
  active: boolean
}

export interface Supplier {
  id: string
  name: string
  type: 'wholesaler' | 'supermarket' | 'other'
  active: boolean
}

export interface PriceReport {
  id: string
  flowerId: string
  supplierId: string
  /** Per bunch for bunch-sold flowers, per stem for stem-sold flowers. */
  pricePence: number
  /** 1 for stem-sold flowers. */
  stemsPerBunch: number
  reportedAt: string
  /** After this moment the report no longer applies. */
  offerEndsAt?: string
  note?: string
  reportedBy: string
  status: 'active' | 'voided'
}

export interface Design {
  id: string
  name: string
  group: string
  optional: boolean
  isLeftoverPool?: boolean
  /** False once retired. Left out means active, as on rows from before retiring existed. */
  active?: boolean
}

export type RecipeLine =
  | { kind: 'role'; role: Role; stemsPerUnit: number }
  | { kind: 'named'; flowerId: string; stemsPerUnit: number }

export interface Recipe {
  designId: string
  size: Size
  lines: RecipeLine[]
  version: number
  /** False once this size is retired. Left out means active. */
  active?: boolean
  /** Flowers kept off this recipe's role lines. New events copy them. */
  excludedFlowerIds?: string[]
}

/** The backend sets the version when a recipe is saved. */
export type RecipeDraft = Omit<Recipe, 'version'>

export interface PlanSettings {
  /** Whole-number percent, so 15 means 15%. */
  thinBunchPercent: number
  priceAmberDays: number
  priceRedDays: number
  bigChangePercent: number
}

export interface PlanDesign {
  designId: string
  size: Size
  quantity: number
  enabled: boolean
  /** A copy, edited only inside this event. */
  recipe: Recipe
  excludedFlowerIds: string[]
}

export interface EventPlan {
  schemaVersion: number
  id: string
  name: string
  date?: string
  targetBudgetPence?: number
  designs: PlanDesign[]
  /** Flower ids ticked for each role. */
  palette: Record<Role, string[]>
  /** Flower id to supplier id, for user overrides. */
  supplierChoice: Record<string, string>
  settings: PlanSettings
  /** Flower id to a note for the gather list. Not used by the engine. */
  gatherNotes?: Record<string, string>
  /** Immutable once set. Edits go to the event, never to this. */
  purchase?: PurchaseSnapshot
  /** Prices that override live ones, from a purchase or kept on a duplicate. */
  frozenPrices?: FrozenPrice[]
  /** Flower id to the price last seen on the review screen. */
  viewedPrices?: Record<string, ViewedPrice>
  /** The share this event was copied from. */
  sharedFrom?: string
}

/** A price as it stood when it was frozen, with the report it came from. */
export interface FrozenPrice {
  flowerId: string
  supplierId: string
  reportId: string
  pricePence: number
  bunchSize: number
  reportedAt: string
}

export interface PurchaseSnapshot {
  purchasedAt: string
  designs: PlanDesign[]
  palette: Record<Role, string[]>
  settings: PlanSettings
  allocation: AllocationResult
  prices: FrozenPrice[]
}

export interface ViewedPrice {
  supplierId: string
  pricePence: number
  bunchSize: number
  stems: number
}

/** The shared data the backend serves. */
export interface MasterData {
  version: number
  flowers: Flower[]
  suppliers: Supplier[]
  designs: Design[]
  recipes: Recipe[]
  prices: PriceReport[]
}

export type NeedsDataReason =
  'no-price' | 'no-bunch-size' | 'override-unavailable' | 'unknown-flower'

export type Warning =
  | {
      code: 'no-flowers-for-role'
      designIndex: number
      designId: string
      role: Role
      stems: number
    }
  | { code: 'needs-data'; flowerId: string; stems: number; reason: NeedsDataReason }
  | { code: 'stale-price'; flowerId: string; supplierId: string; reportId: string; ageDays: number }
  | { code: 'thin-bunch'; flowerId: string; lastBunchStems: number; bunchSize: number }
  | { code: 'supplier-changed'; flowerId: string; fromSupplierId: string; toSupplierId: string }
