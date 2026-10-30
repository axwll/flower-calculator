import type { LineFlower, PlacementRange } from './results'

/** Numbered from 1, for wording such as "bouquets 1 to 3 get 2 scabious". */
export function groupRanges(perPlacement: number[]): PlacementRange[] {
  const ranges: PlacementRange[] = []
  perPlacement.forEach((stems, index) => {
    const last = ranges.at(-1)
    if (last?.stems === stems) last.to = index + 1
    else ranges.push({ from: index + 1, to: index + 1, stems })
  })
  return ranges
}

/**
 * Step 7: lays stems out grouped by flower and deals them round-robin. Each placement gets
 * the same total, and each flower differs by at most 1 between placements.
 */
export function dealLine(stems: ReadonlyMap<string, number>, quantity: number): LineFlower[] {
  let next = 0
  const dealt: LineFlower[] = []

  for (const [flowerId, flowerStems] of stems) {
    if (flowerStems === 0) continue

    const perPlacement = Array.from({ length: quantity }, () => 0)
    for (let stem = 0; stem < flowerStems; stem++) {
      perPlacement[next] = (perPlacement[next] ?? 0) + 1
      next = (next + 1) % quantity
    }
    dealt.push({
      flowerId,
      stems: flowerStems,
      perPlacement,
      ranges: groupRanges(perPlacement),
    })
  }
  return dealt
}
