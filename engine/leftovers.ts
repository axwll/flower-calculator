import type { FlowerAllocation, LeftoverPool } from './results'
import type { Design, EventPlan } from './types'

/** Step 6: enabled pool designs, with spare stems shared out for information only. */
export function buildLeftoverPools(
  plan: EventPlan,
  designs: Design[],
  flowers: FlowerAllocation[],
): LeftoverPool[] {
  const poolIds = new Set(designs.filter((design) => design.isLeftoverPool).map(({ id }) => id))
  const spareFlowers = flowers.filter((flower) => flower.spare > 0)
  const totalSpare = spareFlowers.reduce((sum, flower) => sum + flower.spare, 0)

  return plan.designs.flatMap((design, designIndex) => {
    if (!design.enabled || design.quantity === 0 || !poolIds.has(design.designId)) return []
    return {
      designIndex,
      designId: design.designId,
      quantity: design.quantity,
      totalSpare,
      flowers: spareFlowers.map(({ flowerId, spare }) => ({
        flowerId,
        spare,
        perPlacement: spare / design.quantity,
      })),
    }
  })
}
