import type { ExpandedLine } from './expand'
import type {
  BudgetCheck,
  DesignAllocation,
  FlowerAllocation,
  GatherItem,
  SupplierOrder,
  Totals,
} from './results'

/** A line with its floating stems placed: final stems per flower. */
export interface AllocatedLine {
  line: ExpandedLine
  stems: Map<string, number>
}

const TOP_DRIVERS = 3

export function buildOrderList(flowers: FlowerAllocation[]): SupplierOrder[] {
  const orders = new Map<string, SupplierOrder>()
  for (const flower of flowers) {
    if (!flower.offer || flower.stems === 0) continue
    const { supplierId } = flower.offer
    const order = orders.get(supplierId) ?? { supplierId, flowers: [], subtotalPence: 0 }
    order.flowers.push(flower)
    order.subtotalPence += flower.costPence
    orders.set(supplierId, order)
  }
  return [...orders.values()].sort((a, b) => (a.supplierId < b.supplierId ? -1 : 1))
}

export function buildGatherList(flowers: FlowerAllocation[]): GatherItem[] {
  return flowers
    .filter((flower) => flower.soldAs === 'foraged' && flower.stems > 0)
    .map(({ flowerId, stems }) => ({ flowerId, stems }))
}

function spareCost({ offer, spare, bunches, costPence }: FlowerAllocation): number {
  return offer && spare > 0 ? Math.round((costPence * spare) / (bunches * offer.bunchSize)) : 0
}

export function buildTotals(flowers: FlowerAllocation[], lines: ExpandedLine[]): Totals {
  return {
    stems: flowers.reduce((sum, flower) => sum + flower.stems, 0),
    unassignedStems: lines.reduce((sum, line) => sum + line.unassigned, 0),
    spareStems: flowers.reduce((sum, flower) => sum + flower.spare, 0),
    spareCostPence: flowers.reduce((sum, flower) => sum + spareCost(flower), 0),
    costPence: flowers.reduce((sum, flower) => sum + flower.costPence, 0),
    needsDataFlowers: flowers.filter((flower) => flower.needsData && flower.stems > 0).length,
  }
}

/**
 * Step 8: spreads one flower's cost over designs by stems used, so spare stems are paid for.
 * Largest-remainder rounding keeps whole pence and sums exactly to the flower's cost.
 */
function splitCost(costPence: number, stemsByDesign: Map<number, number>): Map<number, number> {
  const totalStems = [...stemsByDesign.values()].reduce((sum, stems) => sum + stems, 0)
  const shares = [...stemsByDesign].map(([designIndex, stems]) => ({
    designIndex,
    pence: Math.floor((costPence * stems) / totalStems),
    remainder: (costPence * stems) % totalStems,
  }))

  const unallocated = costPence - shares.reduce((sum, share) => sum + share.pence, 0)
  const byRemainder = [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.designIndex - b.designIndex,
  )
  byRemainder.slice(0, unallocated).forEach((share) => (share.pence += 1))

  return new Map(shares.map(({ designIndex, pence }) => [designIndex, pence]))
}

export function buildDesignCosts(
  allocatedLines: AllocatedLine[],
  flowers: FlowerAllocation[],
): Map<number, number> {
  const costs = new Map<number, number>()

  for (const flower of flowers) {
    if (flower.costPence === 0) continue

    const stemsByDesign = new Map<number, number>()
    for (const { line, stems } of allocatedLines) {
      const lineStems = stems.get(flower.flowerId) ?? 0
      if (lineStems === 0) continue
      stemsByDesign.set(line.designIndex, (stemsByDesign.get(line.designIndex) ?? 0) + lineStems)
    }

    for (const [designIndex, pence] of splitCost(flower.costPence, stemsByDesign)) {
      costs.set(designIndex, (costs.get(designIndex) ?? 0) + pence)
    }
  }
  return costs
}

export function buildBudgetCheck(
  targetPence: number | undefined,
  totals: Totals,
  flowers: FlowerAllocation[],
  designs: DesignAllocation[],
): BudgetCheck | null {
  if (targetPence === undefined || totals.costPence <= targetPence) return null

  return {
    targetPence,
    overByPence: totals.costPence - targetPence,
    topFlowers: [...flowers]
      .sort((a, b) => b.costPence - a.costPence)
      .slice(0, TOP_DRIVERS)
      .map(({ flowerId, costPence }) => ({ flowerId, costPence })),
    topDesigns: [...designs]
      .sort((a, b) => b.costPence - a.costPence || a.designIndex - b.designIndex)
      .slice(0, TOP_DRIVERS)
      .map(({ designIndex, designId, costPence }) => ({ designIndex, designId, costPence })),
  }
}
