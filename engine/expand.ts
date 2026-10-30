import type { EventPlan, PlanDesign, RecipeLine, Role, Warning } from './types'

/** One recipe line of an enabled design, split across its eligible flowers. */
export interface ExpandedLine {
  /** Position in `plan.designs`. A design can appear twice at different sizes. */
  designIndex: number
  lineIndex: number
  designId: string
  quantity: number
  stemsPerUnit: number
  /** Null for a named line. */
  role: Role | null
  total: number
  /** Sorted, so results do not depend on the order flowers were ticked. */
  eligibleFlowerIds: string[]
  /** Stems each eligible flower gets before floating stems are placed. */
  equalShare: number
  floating: number
  unassigned: number
}

export interface Expansion {
  lines: ExpandedLine[]
  warnings: Warning[]
}

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a whole number of 0 or more, got ${value}`)
  }
}

function eligibleFlowers(line: RecipeLine, plan: EventPlan, design: PlanDesign): string[] {
  if (line.kind === 'named') return [line.flowerId]
  const excluded = new Set(design.excludedFlowerIds)
  return [...new Set(plan.palette[line.role])].filter((id) => !excluded.has(id)).sort()
}

/** Step 1: splits at the line total, not per placement. */
export function expandPlan(plan: EventPlan): Expansion {
  const lines: ExpandedLine[] = []
  const warnings: Warning[] = []

  plan.designs.forEach((design, designIndex) => {
    if (!design.enabled) return
    assertCount(design.quantity, 'Quantity')

    design.recipe.lines.forEach((line, lineIndex) => {
      assertCount(line.stemsPerUnit, 'Stems per unit')

      const total = line.stemsPerUnit * design.quantity
      const eligibleFlowerIds = eligibleFlowers(line, plan, design)
      const k = eligibleFlowerIds.length
      const role = line.kind === 'role' ? line.role : null

      lines.push({
        designIndex,
        lineIndex,
        designId: design.designId,
        quantity: design.quantity,
        stemsPerUnit: line.stemsPerUnit,
        role,
        total,
        eligibleFlowerIds,
        equalShare: k === 0 ? 0 : Math.floor(total / k),
        floating: k === 0 ? 0 : total % k,
        unassigned: k === 0 ? total : 0,
      })

      if (role !== null && k === 0 && total > 0) {
        warnings.push({
          code: 'no-flowers-for-role',
          designIndex,
          designId: design.designId,
          role,
          stems: total,
        })
      }
    })
  })

  return { lines, warnings }
}
