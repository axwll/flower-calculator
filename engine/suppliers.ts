import type { Offer, OfferResolution } from './prices'
import type { NeedsDataReason, SoldAs } from './types'

export interface SupplierDecision {
  /** Null means needs data. */
  offer: Offer | null
  missing: NeedsDataReason | null
  /** Stale prices cheaper than the chosen one, for showing as flagged options. */
  staleAlternatives: Offer[]
}

export function costToCover(soldAs: SoldAs, offer: Offer, stems: number): number {
  const units = soldAs === 'bunch' ? Math.ceil(stems / offer.bunchSize) : stems
  return units * offer.pricePence
}

function cheapest(soldAs: SoldAs, stems: number, offers: Offer[]): Offer | undefined {
  return offers.reduce<Offer | undefined>((best, offer) => {
    if (!best) return offer
    const difference = costToCover(soldAs, offer, stems) - costToCover(soldAs, best, stems)
    return difference < 0 || (difference === 0 && offer.supplierId < best.supplierId) ? offer : best
  }, undefined)
}

function newest(offers: Offer[]): Offer[] {
  const youngest = Math.min(...offers.map((offer) => offer.ageDays))
  return offers.filter((offer) => offer.ageDays === youngest)
}

/**
 * Step 3. A flower with no equal share still needs a price and bunch size for floating
 * placement, so it is priced as if it needs 1 stem.
 */
export function chooseSupplier(
  soldAs: SoldAs,
  stems: number,
  resolution: OfferResolution,
  overrideSupplierId?: string,
): SupplierDecision {
  const { offers, missing } = resolution
  const needed = Math.max(stems, 1)

  let chosen: Offer | undefined
  if (overrideSupplierId !== undefined) {
    chosen = offers.find((offer) => offer.supplierId === overrideSupplierId)
    if (!chosen) return { offer: null, missing: 'override-unavailable', staleAlternatives: [] }
  } else {
    const usable = offers.filter((offer) => offer.freshness !== 'red')
    chosen = cheapest(soldAs, needed, usable.length > 0 ? usable : newest(offers))
  }

  if (!chosen) return { offer: null, missing, staleAlternatives: [] }

  const chosenCost = costToCover(soldAs, chosen, needed)
  const staleAlternatives = offers.filter(
    (offer) =>
      offer.freshness === 'red' &&
      offer !== chosen &&
      costToCover(soldAs, offer, needed) < chosenCost,
  )
  return { offer: chosen, missing: null, staleAlternatives }
}
