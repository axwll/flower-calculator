import { aggregateStems } from './aggregate'
import { calculatePurchase } from './bunches'
import { expandPlan } from './expand'
import { placeFloating } from './floating'
import type { FloatingFlower } from './floating'
import { buildLeftoverPools } from './leftovers'
import { dealLine } from './placements'
import { resolveOffers } from './prices'
import type { AllocationResult, DesignAllocation, FlowerAllocation } from './results'
import {
  buildBudgetCheck,
  buildDesignCosts,
  buildGatherList,
  buildOrderList,
  buildTotals,
} from './rollups'
import type { AllocatedLine } from './rollups'
import { chooseSupplier } from './suppliers'
import type { SupplierDecision } from './suppliers'
import type { Design, EventPlan, Flower, PriceReport } from './types'

export interface AllocationInput {
  plan: EventPlan
  flowers: Flower[]
  designs: Design[]
  prices: PriceReport[]
  now: string
}

const NO_OFFER: SupplierDecision = { offer: null, missing: null, staleAlternatives: [] }

/** A flower missing from the catalogue is counted as a bunch flower with needs data. */
function unknownFlower(id: string): Flower {
  return { id, name: id, roles: [], soldAs: 'bunch', trackLeftovers: false, active: false }
}

export function allocate({
  plan,
  flowers,
  designs,
  prices,
  now,
}: AllocationInput): AllocationResult {
  const { lines, warnings } = expandPlan(plan)
  const equalShares = aggregateStems(lines)
  const catalogue = new Map(flowers.map((flower) => [flower.id, flower]))

  const decide = (flowerId: string, stems: number): SupplierDecision => {
    const flower = catalogue.get(flowerId)
    if (!flower) return { ...NO_OFFER, missing: 'unknown-flower' }
    if (flower.soldAs === 'foraged') return NO_OFFER
    return chooseSupplier(
      flower.soldAs,
      stems,
      resolveOffers(flower, prices, plan.settings, now),
      plan.supplierChoice[flowerId],
    )
  }

  const decisions = new Map([...equalShares].map(([id, stems]) => [id, decide(id, stems)]))

  const floatingFlowers = new Map<string, FloatingFlower>(
    [...equalShares].map(([id, stems]) => {
      const offer = decisions.get(id)?.offer ?? null
      return [
        id,
        {
          soldAs: catalogue.get(id)?.soldAs ?? 'bunch',
          stems,
          bunchSize: offer?.bunchSize ?? null,
          pricePence: offer?.pricePence ?? null,
        },
      ]
    }),
  )
  const placement = placeFloating(lines, floatingFlowers)

  const finalStems = new Map(equalShares)
  for (const id of placement.flat()) finalStems.set(id, (finalStems.get(id) ?? 0) + 1)

  const results = [...finalStems].map(([flowerId, stems]): FlowerAllocation => {
    const flower = catalogue.get(flowerId) ?? unknownFlower(flowerId)
    const first = decisions.get(flowerId) ?? NO_OFFER

    // Step 4 re-check: a single pass, and stems are not placed again, so it cannot loop.
    const decision = first.offer && stems > 0 ? decide(flowerId, stems) : first
    if (first.offer && decision.offer && decision.offer.supplierId !== first.offer.supplierId) {
      warnings.push({
        code: 'supplier-changed',
        flowerId,
        fromSupplierId: first.offer.supplierId,
        toSupplierId: decision.offer.supplierId,
      })
    }

    const { offer, missing, staleAlternatives } = decision
    const purchase = calculatePurchase(flower, stems, offer, plan.settings.thinBunchPercent)

    if (missing && stems > 0) {
      warnings.push({ code: 'needs-data', flowerId, stems, reason: missing })
    }
    if (offer?.freshness === 'red' && stems > 0) {
      warnings.push({
        code: 'stale-price',
        flowerId,
        supplierId: offer.supplierId,
        reportId: offer.reportId,
        ageDays: offer.ageDays,
      })
    }
    if (purchase.thinBunch) {
      warnings.push({ code: 'thin-bunch', flowerId, ...purchase.thinBunch })
    }

    return {
      flowerId,
      soldAs: flower.soldAs,
      stems,
      offer,
      needsData: missing,
      staleAlternatives,
      bunches: purchase.bunches,
      spare: purchase.spare,
      costPence: purchase.costPence,
    }
  })

  const allocatedLines = lines.map((line, index): AllocatedLine => {
    const floating = new Set(placement[index])
    return {
      line,
      stems: new Map(
        line.eligibleFlowerIds.map((id) => [id, line.equalShare + (floating.has(id) ? 1 : 0)]),
      ),
    }
  })

  const poolIds = new Set(designs.filter((design) => design.isLeftoverPool).map(({ id }) => id))
  const designCosts = buildDesignCosts(allocatedLines, results)
  const designResults = plan.designs.flatMap((design, designIndex): DesignAllocation[] => {
    if (!design.enabled || poolIds.has(design.designId)) return []
    return [
      {
        designIndex,
        designId: design.designId,
        size: design.size,
        quantity: design.quantity,
        costPence: designCosts.get(designIndex) ?? 0,
        lines: allocatedLines
          .filter(({ line }) => line.designIndex === designIndex)
          .map(({ line, stems }) => ({
            role: line.role,
            stemsPerUnit: line.stemsPerUnit,
            unassignedStems: line.unassigned,
            flowers: dealLine(stems, line.quantity),
          })),
      },
    ]
  })

  const totals = buildTotals(results, lines)

  return {
    flowers: results,
    orderList: buildOrderList(results),
    gatherList: buildGatherList(results),
    leftoverPools: buildLeftoverPools(plan, designs, results),
    designs: designResults,
    totals,
    budget: buildBudgetCheck(plan.targetBudgetPence, totals, results, designResults),
    warnings,
  }
}
