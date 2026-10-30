import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'

import { useEventStore } from './stores/event'
import DesignsView from './views/DesignsView.vue'
import EventLayout from './views/EventLayout.vue'
import EventSetupView from './views/EventSetupView.vue'
import EventsView from './views/EventsView.vue'
import PaletteView from './views/PaletteView.vue'
import PlaceholderView from './views/PlaceholderView.vue'
import ReviewView from './views/ReviewView.vue'

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
        // Events live in memory for now, so a reload can leave an address with no event.
        beforeEnter: (to) => useEventStore().open(String(to.params.eventId)) || '/events',
        children: [
          { path: 'designs', name: 'designs', component: DesignsView, meta: { summary: true } },
          { path: 'palette', name: 'palette', component: PaletteView, meta: { summary: true } },
          { path: 'review', name: 'review', component: ReviewView },
        ],
      },
      {
        path: '/prices',
        component: PlaceholderView,
        props: { title: 'Prices', detail: 'Live prices from suppliers.' },
      },
      {
        path: '/library',
        component: PlaceholderView,
        props: { title: 'Library', detail: 'Editing recipes, flowers and suppliers.' },
      },
      {
        path: '/settings',
        component: PlaceholderView,
        props: { title: 'Settings', detail: 'Thresholds, nickname and backups.' },
      },
      { path: '/:pathMatch(.*)*', redirect: '/events' },
    ],
  })
}
