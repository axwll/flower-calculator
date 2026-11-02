import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

interface ConfirmOptions {
  yes?: string | undefined
  no?: string | undefined
}

interface ConfirmRequest {
  message: string
  yes: string
  no: string
}

/** Replaces the browser's own pop-ups, which a browser can silently block. */
export const useConfirmStore = defineStore('confirm', () => {
  const request = shallowRef<ConfirmRequest | null>(null)
  let settle: ((answer: boolean) => void) | null = null

  function answer(value: boolean) {
    settle?.(value)
    settle = null
    request.value = null
  }

  function ask(message: string, { yes = 'Yes', no = 'Cancel' }: ConfirmOptions = {}) {
    answer(false)
    request.value = { message, yes, no }
    return new Promise<boolean>((resolve) => {
      settle = resolve
    })
  }

  return { request, ask, answer }
})
