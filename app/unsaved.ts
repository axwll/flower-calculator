import { computed, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { useConfirmStore } from './stores/confirm'

/** Compares a form with its last saved values, and asks before leaving it unsaved. */
export function useUnsavedChanges(values: () => unknown) {
  const confirm = useConfirmStore()
  const read = () => JSON.stringify(values())
  const saved = ref(read())
  const changed = computed(() => read() !== saved.value)

  function markSaved() {
    saved.value = read()
  }

  onBeforeRouteLeave(
    () => !changed.value || confirm.ask('Leave without saving?', { yes: 'Leave', no: 'Stay' }),
  )

  return { changed, markSaved }
}
