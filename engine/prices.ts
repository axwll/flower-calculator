import type { Flower, PlanSettings, PriceReport } from './types'

const DAY_MS = 86_400_000

export type Freshness = 'fresh' | 'amber' | 'red'

/** The usable current price of a flower at one supplier. */
export interface Offer {
  supplierId: string
  reportId: string
  pricePence: number
  /** 1 for stem-sold flowers. */
  bunchSize: number
  reportedAt: string
  ageDays: number
  freshness: Freshness
}

export interface OfferResolution {
  /** Ordered by supplier id. */
  offers: Offer[]
  /** Why there are no offers. Null when there is at least one. */
  missing: 'no-price' | 'no-bunch-size' | null
}

function isNewer(a: PriceReport, b: PriceReport): boolean {
  const difference = Date.parse(a.reportedAt) - Date.parse(b.reportedAt)
  return difference === 0 ? a.id > b.id : difference > 0
}

function hasEnded(report: PriceReport, nowMs: number): boolean {
  return report.offerEndsAt !== undefined && nowMs > Date.parse(report.offerEndsAt)
}

function freshnessFor(ageDays: number, settings: PlanSettings): Freshness {
  if (ageDays > settings.priceRedDays) return 'red'
  return ageDays > settings.priceAmberDays ? 'amber' : 'fresh'
}

/** The newest active report per supplier whose offer has not ended. */
function currentReports(flowerId: string, reports: PriceReport[], nowMs: number): PriceReport[] {
  const current = new Map<string, PriceReport>()
  for (const report of reports) {
    if (report.flowerId !== flowerId || report.status !== 'active') continue
    if (Number.isNaN(Date.parse(report.reportedAt)) || hasEnded(report, nowMs)) continue

    const best = current.get(report.supplierId)
    if (!best || isNewer(report, best)) current.set(report.supplierId, report)
  }
  return [...current.values()].sort((a, b) => (a.supplierId < b.supplierId ? -1 : 1))
}

function isValidPrice(pricePence: number): boolean {
  return Number.isInteger(pricePence) && pricePence >= 0
}

function isValidBunchSize(stemsPerBunch: number): boolean {
  return Number.isInteger(stemsPerBunch) && stemsPerBunch >= 1
}

/**
 * Bad data comes from people, so it never throws. A bad newest report makes that supplier
 * unusable rather than quietly reviving an older price.
 */
export function resolveOffers(
  flower: Flower,
  reports: PriceReport[],
  settings: PlanSettings,
  now: string,
): OfferResolution {
  const nowMs = Date.parse(now)
  const offers: Offer[] = []
  let missing: OfferResolution['missing'] = 'no-price'

  for (const report of currentReports(flower.id, reports, nowMs)) {
    const bunchSize = flower.soldAs === 'stem' ? 1 : report.stemsPerBunch
    if (!isValidPrice(report.pricePence)) continue
    if (!isValidBunchSize(bunchSize)) {
      missing = 'no-bunch-size'
      continue
    }

    const ageDays = (nowMs - Date.parse(report.reportedAt)) / DAY_MS
    offers.push({
      supplierId: report.supplierId,
      reportId: report.id,
      pricePence: report.pricePence,
      bunchSize,
      reportedAt: report.reportedAt,
      ageDays,
      freshness: freshnessFor(ageDays, settings),
    })
  }

  return { offers, missing: offers.length > 0 ? null : missing }
}
