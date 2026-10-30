import type { PlanSettings } from '@engine'

export const DEFAULT_SETTINGS: PlanSettings = {
  thinBunchPercent: 15,
  priceAmberDays: 14,
  priceRedDays: 30,
  bigChangePercent: 50,
}

/** With nothing to compare against, there's nothing to double-check. */
export function isBigChange(beforePence: number, afterPence: number, percent: number): boolean {
  if (beforePence === 0) return false
  return Math.abs(afterPence - beforePence) * 100 > beforePence * percent
}
