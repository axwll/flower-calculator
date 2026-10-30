import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Design, RecipeDraft } from '@engine'

import { apiClient } from '../api/client'
import type { AdminEdit } from '../api/client'
import { readPreference, writePreference } from '../storage/preferences'
import { useCatalogueStore } from './catalogue'
import { usePricesStore } from './prices'

const ADMIN_ON_KEY = 'admin-on'
const NO_CONNECTION = "That didn't save. Check your connection and try again."

/** Readable in the Sheet. Made on the phone, so saving again after a lost reply is harmless. */
export function newId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
  const [random = 0] = crypto.getRandomValues(new Uint32Array(1))
  return `${slug || 'item'}-${random.toString(36)}`
}

/** A variant is a separate design, because there's one recipe per design and size. */
export function newDesignFrom(source: Design, name: string): Design {
  return { id: newId(name), name, group: source.group, optional: source.optional }
}

export const useLibraryStore = defineStore('library', () => {
  const catalogue = useCatalogueStore()
  const prices = usePricesStore()

  const adminOn = ref(readPreference(ADMIN_ON_KEY) === 'yes' && prices.adminKey !== '')
  const saving = ref(false)

  function setAdminOn(on: boolean) {
    adminOn.value = on
    writePreference(ADMIN_ON_KEY, on ? 'yes' : '')
  }

  function setKey(value: string) {
    prices.setAdminKey(value)
    setAdminOn(false)
  }

  /** Returns what to tell the person. */
  async function checkKey(): Promise<string> {
    if (!prices.nickname) return 'Add a nickname first. It goes in the change log.'
    if (!prices.adminKey) return 'Enter the admin key first.'

    const result = await apiClient().send({ action: 'checkAdmin', adminKey: prices.adminKey })
    setAdminOn(result.status === 'sent')
    if (result.status === 'sent') return 'Admin on'
    return result.status === 'retry' ? "Couldn't check. Check your connection." : result.message
  }

  /** Not queued, so the person knows straight away. Returns a problem, or null once saved. */
  async function save(edit: AdminEdit): Promise<string | null> {
    if (saving.value) return null
    if (!prices.nickname) return 'Add a nickname in Settings first.'

    saving.value = true
    const result = await apiClient().send({
      ...edit,
      adminKey: prices.adminKey,
      nickname: prices.nickname,
    })
    if (result.status === 'sent') await catalogue.refresh()
    saving.value = false

    if (result.status === 'sent') return null
    if (result.status === 'retry') return NO_CONNECTION
    if (result.status === 'not-admin') setAdminOn(false)
    return result.message
  }

  /** Saved in one go, so a variant can't end up with only some of its sizes. */
  async function saveNewDesign(
    design: Design,
    drafts: RecipeDraft[],
  ): Promise<{ id: string; problem: string | null }> {
    const recipes = drafts.map((draft) => ({ ...draft, designId: design.id }))
    return { id: design.id, problem: await save({ action: 'saveDesign', design, recipes }) }
  }

  return { adminOn, saving, setKey, checkKey, save, saveNewDesign }
})
