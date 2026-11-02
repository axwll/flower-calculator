import type { LeftoverPool } from '@engine'

import type { WorkPlanCard } from '../stores/event'
import { placementText, plural } from '../wording'

/** Wider than this will not fit a printed page, and the wording still covers it. */
const MAX_GRID_PLACEMENTS = 12

export interface CatalogueNames {
  designName(designId: string): string
  flowerName(flowerId: string): string
}

export interface WorkCardGrid {
  placements: number[]
  rows: { flowerId: string; name: string; cells: number[] }[]
}

export interface WorkCardContent {
  name: string
  heading: string
  numbering?: string
  warning?: string
  flowers: { flowerId: string; name: string; stems: string }[]
  grid?: WorkCardGrid
}

export interface PoolContent {
  name: string
  heading: string
  note: string
  lines: string[]
}

export interface MatrixContent {
  headings: string[]
  rows: { flowerId: string; name: string; cells: number[]; total: number }[]
}

/** When every placement is the same, "each" says it all and a grid only adds length. */
function gridFor(card: WorkPlanCard, names: CatalogueNames): WorkCardGrid | undefined {
  const differs = card.flowers.some((flower) => flower.ranges.length > 1)
  if (card.quantity > MAX_GRID_PLACEMENTS || !differs) return undefined
  return {
    placements: Array.from({ length: card.quantity }, (_, index) => index + 1),
    rows: card.flowers.map(({ flowerId, perPlacement }) => ({
      flowerId,
      name: names.flowerName(flowerId),
      cells: perPlacement,
    })),
  }
}

/** The screen and the PDF both read this, so a helper sees the same words on either. */
export function workCardContent(card: WorkPlanCard, names: CatalogueNames): WorkCardContent {
  const size = card.size === 'Fixed' ? '' : `${card.size} `
  return {
    name: names.designName(card.designId),
    heading: `${size}× ${card.quantity}`,
    numbering: card.quantity > 1 ? `Number them 1 to ${card.quantity}.` : undefined,
    warning:
      card.unassignedStems > 0
        ? `${plural(card.unassignedStems, 'stem')} have no flower chosen.`
        : undefined,
    flowers: card.flowers.map((flower) => ({
      flowerId: flower.flowerId,
      name: names.flowerName(flower.flowerId),
      stems: placementText(flower),
    })),
    grid: gridFor(card, names),
  }
}

export function poolContent(pool: LeftoverPool, names: CatalogueNames): PoolContent {
  return {
    name: names.designName(pool.designId),
    heading: `× ${pool.quantity}`,
    note: "Use what's left. These are the spare stems.",
    lines: pool.flowers.map(
      ({ flowerId, spare }) => `${names.flowerName(flowerId)}: ${plural(spare, 'spare stem')}`,
    ),
  }
}

export function matrixContent(
  cards: WorkPlanCard[],
  names: CatalogueNames,
  designLabel: (designIndex: number) => string,
): MatrixContent {
  const ids = new Set(cards.flatMap((card) => card.flowers.map((item) => item.flowerId)))
  const rows = [...ids]
    .map((flowerId) => {
      const cells = cards.map(
        (card) => card.flowers.find((item) => item.flowerId === flowerId)?.stems ?? 0,
      )
      return {
        flowerId,
        name: names.flowerName(flowerId),
        cells,
        total: cells.reduce((sum, stems) => sum + stems, 0),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    headings: ['Flower', ...cards.map((card) => designLabel(card.designIndex)), 'Total'],
    rows,
  }
}
