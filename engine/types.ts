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
}

export type RecipeLine =
  | { kind: 'role'; role: Role; stemsPerUnit: number }
  | { kind: 'named'; flowerId: string; stemsPerUnit: number }

export interface Recipe {
  designId: string
  size: Size
  lines: RecipeLine[]
  version: number
}

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
