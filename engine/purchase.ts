import { DAY_MS } from './prices'
import type { Offer } from './prices'
import type { AllocationResult, FlowerAllocation } from './results'
import type {
  EventPlan,
  FrozenPrice,
  PlanDesign,
  PurchaseSnapshot,
  SoldAs,
  ViewedPrice,
} from './types'

export interface PurchaseChange {
  flowerId: string
  kind: 'added' | 'more' | 'fewer'
  soldAs: SoldAs
  /** Bunches for bunch-sold flowers with a price, otherwise stems. */
  before: number
  after: number
  addedCostPence: number
}

export type DesignChange = 'added' | 'changed'

export interface PriceChange {
  flowerId: string
  from: Omit<ViewedPrice, 'stems'>
  to: Omit<ViewedPrice, 'stems'>
}

/** Frozen means no longer ageing, so it is always fresh and never flagged as stale. */
export function frozenOffer(price: FrozenPrice, now: string): Offer {
  const { supplierId, reportId, pricePence, bunchSize, reportedAt } = price
  return {
    supplierId,
    reportId,
    pricePence,
    bunchSize,
    reportedAt,
    ageDays: (Date.parse(now) - Date.parse(reportedAt)) / DAY_MS,
    freshness: 'fresh',
    frozen: true,
  }
}

function frozenPrice({ flowerId, stems, offer }: FlowerAllocation): FrozenPrice[] {
  if (!offer || stems === 0) return []
  const { supplierId, reportId, pricePence, bunchSize, reportedAt } = offer
  return [{ flowerId, supplierId, reportId, pricePence, bunchSize, reportedAt }]
}

/** Takes copies, so nothing done to the event afterwards can reach the snapshot. */
export function buildPurchase(
  plan: EventPlan,
  allocation: AllocationResult,
  now: string,
): PurchaseSnapshot {
  const { designs, palette, settings } = plan
  const snapshot: PurchaseSnapshot = {
    purchasedAt: now,
    designs,
    palette,
    settings,
    allocation,
    prices: allocation.flowers.flatMap(frozenPrice),
  }
  return JSON.parse(JSON.stringify(snapshot)) as PurchaseSnapshot
}

function units({ soldAs, offer, bunches, stems }: FlowerAllocation): number {
  return soldAs === 'bunch' && offer ? bunches : stems
}

/** Foraged flowers have no price to buy at, but a flower still awaiting one wasn't bought. */
function wasBought({ soldAs, offer, stems }: FlowerAllocation): boolean {
  return stems > 0 && (offer !== null || soldAs === 'foraged')
}

export function purchaseChanges(
  purchase: PurchaseSnapshot,
  allocation: AllocationResult,
): PurchaseChange[] {
  const bought = new Map(
    purchase.allocation.flowers.filter(wasBought).map((flower) => [flower.flowerId, flower]),
  )
  const inUse = allocation.flowers.filter((flower) => flower.stems > 0)

  const changes = inUse.flatMap((flower): PurchaseChange[] => {
    const { flowerId, soldAs, offer, costPence } = flower
    const earlier = bought.get(flowerId)
    const after = units(flower)
    if (!earlier) {
      return [{ flowerId, kind: 'added', soldAs, before: 0, after, addedCostPence: costPence }]
    }

    const before = units(earlier)
    if (after === before) return []
    const kind = after > before ? 'more' : 'fewer'
    const extra = kind === 'more' ? (after - before) * (offer?.pricePence ?? 0) : 0
    return [{ flowerId, kind, soldAs, before, after, addedCostPence: extra }]
  })

  const gone = [...bought.values()].flatMap((flower): PurchaseChange[] => {
    const { flowerId, soldAs } = flower
    if (inUse.some((item) => item.flowerId === flowerId)) return []
    return [{ flowerId, kind: 'fewer', soldAs, before: units(flower), after: 0, addedCostPence: 0 }]
  })

  return [...changes, ...gone]
}

function isPlaced(design: PlanDesign | undefined): design is PlanDesign {
  return design !== undefined && design.enabled && design.quantity > 0
}

function matches(a: PlanDesign, b: PlanDesign): boolean {
  return (
    a.size === b.size &&
    a.quantity === b.quantity &&
    JSON.stringify(a.recipe.lines) === JSON.stringify(b.recipe.lines) &&
    JSON.stringify(a.excludedFlowerIds) === JSON.stringify(b.excludedFlowerIds)
  )
}

export function designChange(purchase: PurchaseSnapshot, design: PlanDesign): DesignChange | null {
  const earlier = purchase.designs.find((item) => item.designId === design.designId)
  if (!isPlaced(design)) return isPlaced(earlier) ? 'changed' : null
  if (!isPlaced(earlier)) return 'added'
  return matches(earlier, design) ? null : 'changed'
}

function changedPrice(viewed: ViewedPrice, flower: FlowerAllocation): PriceChange | null {
  const { flowerId, offer, stems } = flower
  if (!offer || offer.frozen) return null

  const { supplierId, pricePence, bunchSize } = offer
  const moved = supplierId !== viewed.supplierId
  // The cheapest supplier depends on how many stems are needed, so that's not a price change.
  if (moved && stems !== viewed.stems) return null
  if (!moved && pricePence === viewed.pricePence && bunchSize === viewed.bunchSize) return null

  return {
    flowerId,
    from: {
      supplierId: viewed.supplierId,
      pricePence: viewed.pricePence,
      bunchSize: viewed.bunchSize,
    },
    to: { supplierId, pricePence, bunchSize },
  }
}

export function priceChanges(
  viewed: Record<string, ViewedPrice>,
  allocation: AllocationResult,
): PriceChange[] {
  return allocation.flowers.flatMap((flower) => {
    const earlier = viewed[flower.flowerId]
    const change = earlier ? changedPrice(earlier, flower) : null
    return change ? [change] : []
  })
}

/** Takes in what's new, but leaves a changed price alone so the notice can still show it. */
export function refreshViewed(
  viewed: Record<string, ViewedPrice>,
  allocation: AllocationResult,
): Record<string, ViewedPrice> {
  const changed = new Set(priceChanges(viewed, allocation).map(({ flowerId }) => flowerId))
  const fresh = allocation.flowers.flatMap(
    ({ flowerId, offer, stems }): [string, ViewedPrice][] => {
      if (!offer || offer.frozen || stems === 0 || changed.has(flowerId)) return []
      const { supplierId, pricePence, bunchSize } = offer
      return [[flowerId, { supplierId, pricePence, bunchSize, stems }]]
    },
  )
  return { ...viewed, ...Object.fromEntries(fresh) }
}
