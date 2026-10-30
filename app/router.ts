import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'

import { useEventStore } from './stores/event'
import DesignsView from './views/DesignsView.vue'
import EventLayout from './views/EventLayout.vue'
import EventSetupView from './views/EventSetupView.vue'
import EventsView from './views/EventsView.vue'
import PaletteView from './views/PaletteView.vue'
import PlaceholderView from './views/PlaceholderView.vue'
import PriceFlowerView from './views/PriceFlowerView.vue'
import PricesView from './views/PricesView.vue'
import ReviewView from './views/ReviewView.vue'
import SettingsView from './views/SettingsView.vue'
import ShopView from './views/ShopView.vue'
import WorkPlanView from './views/WorkPlanView.vue'

/** Hash URLs, because GitHub Pages cannot serve deep links. */
export function createAppRouter(history: RouterHistory = createWebHashHistory()) {
  return createRouter({
    history,
    routes: [
      { path: '/', redirect: '/events' },
      { path: '/events', component: EventsView },
      { path: '/events/new', component: EventSetupView },
      {
        path: '/events/:eventId',
        component: EventLayout,
        redirect: { name: 'designs' },
        beforeEnter: async (to) => {
          const store = useEventStore()
          await store.whenReady()
          return store.open(String(to.params.eventId)) || '/events'
        },
        children: [
          { path: 'designs', name: 'designs', component: DesignsView, meta: { summary: true } },
          { path: 'palette', name: 'palette', component: PaletteView, meta: { summary: true } },
          { path: 'review', name: 'review', component: ReviewView },
          { path: 'work-plan', name: 'work-plan', component: WorkPlanView },
        ],
      },
      { path: '/prices', component: PricesView },
      { path: '/prices/shop', component: ShopView },
      { path: '/prices/:flowerId', component: PriceFlowerView },
      {
        path: '/library',
        component: PlaceholderView,
        props: { title: 'Library', detail: 'Editing recipes, flowers and suppliers.' },
      },
      { path: '/settings', component: SettingsView },
      { path: '/:pathMatch(.*)*', redirect: '/events' },
    ],
  })
}
