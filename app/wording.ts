import { formatPence } from '@engine'
import type {
  ExpandedLine,
  LineFlower,
  NeedsDataReason,
  PriceChange,
  PurchaseChange,
  Role,
  Warning,
} from '@engine'

export const ROLES: Role[] = ['focal', 'secondary', 'filler', 'foliage', 'accent']

const ROLE_LABELS: Record<Role, string> = {
  focal: 'Focal',
  secondary: 'Secondary',
  filler: 'Filler',
  foliage: 'Foliage',
  accent: 'Accent',
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role]
}

/** Commas every three digits. Anything that isn't an amount is left for the form to refuse. */
export function groupPounds(text: string): string {
  const match = /^(£?)([\d,]*)(\.\d*)?$/.exec(text.trim())
  if (!match) return text
  const [, sign = '', whole = '', fraction = ''] = match
  return sign + whole.replaceAll(',', '').replace(/\B(?=(\d{3})+$)/g, ',') + fraction
}

const DAY_IN_MS = 86_400_000

/** Counts calendar days, so the answer doesn't change with the time of day or the clocks. */
export function daysUntilText(date: string, now = new Date()): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const days = Math.round(
    (Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      DAY_IN_MS,
  )
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function splitText({
  total,
  equalShare,
  floating,
  eligibleFlowerIds,
}: Pick<ExpandedLine, 'total' | 'equalShare' | 'floating' | 'eligibleFlowerIds'>): string {
  const k = eligibleFlowerIds.length
  if (k === 0) return `${plural(total, 'stem')} with no flowers ticked`

  const shares = eligibleFlowerIds.map(() => equalShare).join(', ')
  const float = floating > 0 ? ` + ${floating} floating` : ''
  return `${plural(total, 'stem')} across ${plural(k, 'flower')}: ${shares}${float}`
}

export interface Names {
  flowerName: (id: string) => string
  supplierName: (id: string) => string
  designName: (id: string) => string
}

const NEEDS_DATA_TEXT: Record<NeedsDataReason, string> = {
  'no-price': 'has no price yet',
  'no-bunch-size': 'has no bunch size yet',
  'override-unavailable': 'has no price from the chosen supplier',
  'unknown-flower': 'is not in the flower list',
}

export function warningText(warning: Warning, names: Names): string {
  switch (warning.code) {
    case 'no-flowers-for-role':
      return `No flowers ticked for ${warning.role} in ${names.designName(warning.designId)}: ${plural(warning.stems, 'stem')} unassigned.`
    case 'needs-data':
      return `${names.flowerName(warning.flowerId)} ${NEEDS_DATA_TEXT[warning.reason]}: ${plural(warning.stems, 'stem')} counted but not costed.`
    case 'stale-price':
      return `${names.flowerName(warning.flowerId)}: the price from ${names.supplierName(warning.supplierId)} is ${Math.floor(warning.ageDays)} days old.`
    case 'thin-bunch':
      return `${names.flowerName(warning.flowerId)}: only ${warning.lastBunchStems} of the ${warning.bunchSize} stems in the last bunch ${warning.lastBunchStems === 1 ? 'is' : 'are'} used.`
    case 'supplier-changed':
      return `${names.flowerName(warning.flowerId)}: moved to ${names.supplierName(warning.toSupplierId)}, which is cheaper once every stem is counted.`
  }
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

export function dayText(time: string): string {
  return DAY_FORMAT.format(new Date(time))
}

function changeUnits({ unit }: PurchaseChange, count: number): string {
  return unit === 'bunch' ? `${count} bunch${count === 1 ? '' : 'es'}` : plural(count, 'stem')
}

export function purchaseChangeText(change: PurchaseChange, names: Names): string {
  const name = names.flowerName(change.flowerId)
  const difference = Math.abs(change.after - change.before)
  switch (change.kind) {
    case 'added':
      return `${name}: ${changeUnits(change, change.after)} added after purchase.`
    case 'more':
      return `${name}: ${changeUnits(change, difference)} more needed after purchase.`
    case 'fewer':
      return `${name}: ${changeUnits(change, difference)} fewer needed after purchase.`
  }
}

export function priceChangeText({ flowerId, from, to }: PriceChange, names: Names): string {
  const place = from.supplierId === to.supplierId ? '' : ` at ${names.supplierName(to.supplierId)}`
  const bunch = from.bunchSize === to.bunchSize ? '' : `, now ${to.bunchSize} stems a bunch`
  return `${names.flowerName(flowerId)}: was ${formatPence(from.pricePence)}, now ${formatPence(to.pricePence)}${place}${bunch}.`
}

export function placementText({
  perPlacement,
  ranges,
}: Pick<LineFlower, 'perPlacement' | 'ranges'>): string {
  if (perPlacement.length === 1) return String(perPlacement[0])
  if (ranges.length === 1) return `${ranges[0]?.stems} each`

  return ranges
    .filter((range) => range.stems > 0)
    .map(({ from, to, stems }) =>
      from === to ? `${stems} for ${from}` : `${stems} each for ${from} to ${to}`,
    )
    .join(', ')
}
