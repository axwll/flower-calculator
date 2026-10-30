import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'

import App from '../App.vue'
import { createAppRouter } from '../router'
import { useEventStore } from '../stores/event'

export async function mountApp(path = '/') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router }
}

export async function mountEvent(step: 'designs' | 'palette' | 'review' | 'work-plan' = 'designs') {
  const mounted = await mountApp()
  const store = useEventStore()
  const id = store.createEvent({ name: 'Test event' })
  await mounted.router.push(`/events/${id}/${step}`)
  await flushPromises()
  return { ...mounted, store }
}

export function setDesign(
  store: ReturnType<typeof useEventStore>,
  designId: string,
  quantity: number,
) {
  const index = store.current?.designs.findIndex((item) => item.designId === designId) ?? -1
  store.setEnabled(index, true)
  store.setQuantity(index, quantity)
}
