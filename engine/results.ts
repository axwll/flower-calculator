import type { Offer } from './prices'
import type { NeedsDataReason, Role, Size, SoldAs, Warning } from './types'

export interface FlowerAllocation {
  flowerId: string
  soldAs: SoldAs
  stems: number
  /** Null for foraged and needs-data flowers. */
  offer: Offer | null
  needsData: NeedsDataReason | null
  staleAlternatives: Offer[]
  bunches: number
  spare: number
  costPence: number
}

export interface SupplierOrder {
  supplierId: string
  flowers: FlowerAllocation[]
  subtotalPence: number
}

export interface GatherItem {
  flowerId: string
  stems: number
}

export interface LeftoverPool {
  designIndex: number
  designId: string
  quantity: number
  totalSpare: number
  /** Information only: nothing caps or enforces these figures. */
  flowers: { flowerId: string; spare: number; perPlacement: number }[]
}

export interface PlacementRange {
  from: number
  to: number
  stems: number
}

export interface LineFlower {
  flowerId: string
  stems: number
  /** Stems for each placement, in placement order. */
  perPlacement: number[]
  ranges: PlacementRange[]
}

export interface DesignLine {
  /** Null for a named line. */
  role: Role | null
  stemsPerUnit: number
  /** Not dealt to placements, so placements sum to the recipe less these stems. */
  unassignedStems: number
  flowers: LineFlower[]
}

export interface DesignAllocation {
  /** Position in `plan.designs`. */
  designIndex: number
  designId: string
  size: Size
  quantity: number
  costPence: number
  lines: DesignLine[]
}

export interface Totals {
  stems: number
  unassignedStems: number
  spareStems: number
  spareCostPence: number
  /** Excludes needs-data flowers. */
  costPence: number
  needsDataFlowers: number
}

export interface BudgetCheck {
  targetPence: number
  overByPence: number
  topFlowers: { flowerId: string; costPence: number }[]
  topDesigns: { designIndex: number; designId: string; costPence: number }[]
}

export interface AllocationResult {
  flowers: FlowerAllocation[]
  orderList: SupplierOrder[]
  gatherList: GatherItem[]
  leftoverPools: LeftoverPool[]
  designs: DesignAllocation[]
  totals: Totals
  /** Null unless a target is set and exceeded. */
  budget: BudgetCheck | null
  warnings: Warning[]
}
