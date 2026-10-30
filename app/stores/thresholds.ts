import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { PlanSettings } from '@engine'

import { DEFAULT_SETTINGS } from '../pricing'
import { readPreference, writePreference } from '../storage/preferences'

const THRESHOLDS_KEY = 'thresholds'

export function thresholdProblem(settings: PlanSettings): string | null {
  const { thinBunchPercent, priceAmberDays, priceRedDays, bigChangePercent } = settings
  if (!Object.values(settings).every((value) => Number.isInteger(value))) {
    return 'Use whole numbers.'
  }
  if (thinBunchPercent < 0 || thinBunchPercent > 100) {
    return 'The thin-bunch percent must be between 0 and 100.'
  }
  if (priceAmberDays < 1) return 'Amber needs to be at least 1 day.'
  if (priceRedDays <= priceAmberDays) return 'Red needs to be later than amber.'
  return bigChangePercent < 1 ? 'The big price change needs to be at least 1%.' : null
}

function loadSettings(): PlanSettings {
  try {
    const saved = JSON.parse(readPreference(THRESHOLDS_KEY) || '{}') as Partial<PlanSettings>
    const settings = { ...DEFAULT_SETTINGS, ...saved }
    return thresholdProblem(settings) ? { ...DEFAULT_SETTINGS } : settings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Kept per phone. Events copy these when created, so changing them never alters an event. */
export const useThresholdsStore = defineStore('thresholds', () => {
  const settings = ref(loadSettings())

  function save(next: PlanSettings) {
    settings.value = next
    writePreference(THRESHOLDS_KEY, JSON.stringify(next))
  }

  return { settings, save }
})
