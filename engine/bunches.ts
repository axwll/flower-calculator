import type { Offer } from './prices'
import type { Flower } from './types'

export interface ThinBunch {
  lastBunchStems: number
  bunchSize: number
}

export interface Purchase {
  bunches: number
  spare: number
  costPence: number
  thinBunch: ThinBunch | null
}

const NOTHING: Purchase = { bunches: 0, spare: 0, costPence: 0, thinBunch: null }

function thinBunchFor(
  stems: number,
  bunches: number,
  bunchSize: number,
  thinBunchPercent: number,
): ThinBunch | null {
  const lastBunchStems = stems - (bunches - 1) * bunchSize
  const threshold = Math.floor((thinBunchPercent * bunchSize) / 100)
  return lastBunchStems <= threshold && lastBunchStems < bunchSize
    ? { lastBunchStems, bunchSize }
    : null
}

/** Step 5. A null offer means foraged or needs data, neither of which is bought. */
export function calculatePurchase(
  flower: Flower,
  stems: number,
  offer: Offer | null,
  thinBunchPercent: number,
): Purchase {
  if (!offer || stems === 0) return NOTHING
  if (flower.soldAs === 'stem') return { ...NOTHING, costPence: stems * offer.pricePence }

  const bunches = Math.ceil(stems / offer.bunchSize)
  return {
    bunches,
    spare: bunches * offer.bunchSize - stems,
    costPence: bunches * offer.pricePence,
    thinBunch: flower.trackLeftovers
      ? thinBunchFor(stems, bunches, offer.bunchSize, thinBunchPercent)
      : null,
  }
}
