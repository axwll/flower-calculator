import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { installHelp } from '../install'
import { requestPersistentStorage } from '../storage/persistence'
import type { StorageStatus } from '../storage/persistence'

const DISMISSED_KEY = 'install-guide-dismissed'

/** Only Chromium browsers fire this, and it isn't in TypeScript's DOM types. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'yes'
  } catch {
    return false
  }
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export const useInstallStore = defineStore('install', () => {
  const prompt = shallowRef<InstallPromptEvent | null>(null)
  const dismissed = ref(wasDismissed())
  const standalone = ref(isStandalone())
  const storageStatus = ref<StorageStatus | null>(null)

  const canPrompt = computed(() => prompt.value !== null)
  const help = computed(() =>
    installHelp({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: standalone.value,
      canPrompt: canPrompt.value,
    }),
  )

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    prompt.value = event as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    prompt.value = null
    standalone.value = true
  })

  void requestPersistentStorage().then((status) => (storageStatus.value = status))

  async function install() {
    const offered = prompt.value
    prompt.value = null
    await offered?.prompt()
  }

  /** The guide still works if the browser blocks storage. It just reappears next time. */
  function dismiss() {
    dismissed.value = true
    try {
      localStorage.setItem(DISMISSED_KEY, 'yes')
    } catch {
      return
    }
  }

  return { canPrompt, dismissed, help, storageStatus, install, dismiss }
})
