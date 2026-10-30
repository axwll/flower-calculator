import type { SoldAs } from './types'

export interface FloatingFlower {
  soldAs: SoldAs
  /** Stems before any floating stems are placed. */
  stems: number
  /** Null for foraged and needs-data flowers. */
  bunchSize: number | null
  /** Null for foraged and needs-data flowers. */
  pricePence: number | null
}

export interface FloatingLine {
  eligibleFlowerIds: string[]
  floating: number
}

/** Compared in this order: needs-data stems, then spare stems, then cost. */
export interface PlacementScore {
  needsDataStems: number
  spare: number
  cost: number
}

/**
 * The priority rules can be beaten when an early line uses up a saving a later line needed,
 * so small cases are searched exhaustively. Allocation reruns on every tap in the UI, and
 * this cap keeps the search to about 4ms on a laptop for a plan with 6 flowers. The cost grows
 * with the number of flowers, and phones are slower.
 */
const MAX_SEARCH_COMBINATIONS = 5_000

function spareStems(stems: number, bunchSize: number): number {
  return (bunchSize - (stems % bunchSize)) % bunchSize
}

/** Step 4 priority as a sort key, lowest first. */
function rank(flower: FloatingFlower, stems: number): [number, number, number] {
  if (flower.soldAs === 'foraged') return [2, 0, 0]
  if (flower.bunchSize === null || flower.pricePence === null) return [5, 0, 0]
  if (flower.soldAs === 'stem') return [3, flower.pricePence, 0]

  const spare = spareStems(stems, flower.bunchSize)
  return spare > 0 ? [1, -spare, 0] : [4, flower.pricePence, flower.bunchSize]
}

function compareRanks(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

function flowerFor(flowers: ReadonlyMap<string, FloatingFlower>, id: string): FloatingFlower {
  const flower = flowers.get(id)
  if (!flower) throw new Error(`No flower data for ${id}`)
  return flower
}

function placeGreedy(
  lines: readonly FloatingLine[],
  flowers: ReadonlyMap<string, FloatingFlower>,
): string[][] {
  const stems = new Map([...flowers].map(([id, flower]) => [id, flower.stems]))

  return lines.map((line) => {
    const remaining = [...line.eligibleFlowerIds]
    const chosen: string[] = []

    for (let placed = 0; placed < line.floating; placed++) {
      const ranked = remaining
        .map((id) => ({ id, key: rank(flowerFor(flowers, id), stems.get(id) ?? 0) }))
        .sort((a, b) => compareRanks(a.key, b.key))
      const pick = ranked[0]?.id
      if (pick === undefined) break

      chosen.push(pick)
      remaining.splice(remaining.indexOf(pick), 1)
      stems.set(pick, (stems.get(pick) ?? 0) + 1)
    }
    return chosen.sort()
  })
}

export function scorePlacement(
  flowers: ReadonlyMap<string, FloatingFlower>,
  placement: readonly string[][],
): PlacementScore {
  const extra = new Map<string, number>()
  for (const id of placement.flat()) extra.set(id, (extra.get(id) ?? 0) + 1)

  const score: PlacementScore = { needsDataStems: 0, spare: 0, cost: 0 }
  for (const [id, flower] of flowers) {
    const stems = flower.stems + (extra.get(id) ?? 0)
    if (flower.soldAs === 'foraged') continue
    if (flower.bunchSize === null || flower.pricePence === null) {
      score.needsDataStems += stems
    } else if (flower.soldAs === 'stem') {
      score.cost += stems * flower.pricePence
    } else {
      score.spare += spareStems(stems, flower.bunchSize)
      score.cost += Math.ceil(stems / flower.bunchSize) * flower.pricePence
    }
  }
  return score
}

export function isBetterScore(a: PlacementScore, b: PlacementScore): boolean {
  const difference = a.needsDataStems - b.needsDataStems || a.spare - b.spare || a.cost - b.cost
  return difference < 0
}

function combinations(items: readonly string[], size: number): string[][] {
  if (size === 0) return [[]]
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]),
  )
}

function combinationCount(n: number, k: number): number {
  let count = 1
  for (let i = 0; i < k; i++) count = (count * (n - i)) / (i + 1)
  return count
}

function isSearchable(lines: readonly FloatingLine[]): boolean {
  let total = 1
  for (const line of lines) {
    total *= combinationCount(line.eligibleFlowerIds.length, line.floating)
    if (total > MAX_SEARCH_COMBINATIONS) return false
  }
  return true
}

/** Step 4: returns the flowers chosen for each line, in line order. */
export function placeFloating(
  lines: readonly FloatingLine[],
  flowers: ReadonlyMap<string, FloatingFlower>,
): string[][] {
  const greedy = placeGreedy(lines, flowers)
  if (!isSearchable(lines)) return greedy

  const choices = lines.map((line) => combinations(line.eligibleFlowerIds, line.floating))
  let best = greedy
  let bestScore = scorePlacement(flowers, greedy)

  const walk = (lineIndex: number, placement: string[][]): void => {
    const lineChoices = choices[lineIndex]
    if (!lineChoices) {
      const score = scorePlacement(flowers, placement)
      if (isBetterScore(score, bestScore)) {
        best = placement.map((choice) => [...choice].sort())
        bestScore = score
      }
      return
    }
    for (const choice of lineChoices) {
      placement[lineIndex] = choice
      walk(lineIndex + 1, placement)
    }
  }
  walk(0, [])

  return best
}
