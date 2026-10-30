import type { ExpandedLine } from './expand'

/** Step 2: equal-share stems per flower across the whole plan, ordered by flower id. */
export function aggregateStems(lines: ExpandedLine[]): Map<string, number> {
  const stems = new Map<string, number>()
  for (const line of lines) {
    for (const flowerId of line.eligibleFlowerIds) {
      stems.set(flowerId, (stems.get(flowerId) ?? 0) + line.equalShare)
    }
  }
  return new Map([...stems].sort(([a], [b]) => (a < b ? -1 : 1)))
}
