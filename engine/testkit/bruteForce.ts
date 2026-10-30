import { isBetterScore, scorePlacement } from '../floating'
import type { FloatingFlower, FloatingLine, PlacementScore } from '../floating'

function combinations(items: string[], size: number): string[][] {
  if (size === 0) return [[]]
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]),
  )
}

/** Tries every way to place the floating stems and returns the best score. */
export function bruteForceBest(
  lines: FloatingLine[],
  flowers: ReadonlyMap<string, FloatingFlower>,
): PlacementScore {
  let best: PlacementScore | undefined

  const walk = (lineIndex: number, placement: string[][]): void => {
    const line = lines[lineIndex]
    if (!line) {
      const score = scorePlacement(flowers, placement)
      if (!best || isBetterScore(score, best)) best = score
      return
    }
    for (const choice of combinations(line.eligibleFlowerIds, line.floating)) {
      walk(lineIndex + 1, [...placement, choice])
    }
  }
  walk(0, [])

  if (!best) throw new Error('Brute force found no placement')
  return best
}
