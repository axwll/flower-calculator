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

export async function mountEvent(step: 'designs' | 'palette' | 'review' = 'designs') {
  const mounted = await mountApp()
  const store = useEventStore()
  const id = store.createEvent({ name: 'Test event' })
  await mounted.router.push(`/events/${id}/${step}`)
  await flushPromises()
  return { ...mounted, store }
}
