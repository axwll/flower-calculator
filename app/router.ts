import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'

import { useEventStore } from './stores/event'
import { useLibraryStore } from './stores/library'
import DesignEditView from './views/DesignEditView.vue'
import DesignsView from './views/DesignsView.vue'
import EventLayout from './views/EventLayout.vue'
import EventSetupView from './views/EventSetupView.vue'
import EventsView from './views/EventsView.vue'
import FlowerEditView from './views/FlowerEditView.vue'
import LibraryView from './views/LibraryView.vue'
import PaletteView from './views/PaletteView.vue'
import PriceFlowerView from './views/PriceFlowerView.vue'
import PricesView from './views/PricesView.vue'
import PurchaseView from './views/PurchaseView.vue'
import ReviewView from './views/ReviewView.vue'
import SettingsView from './views/SettingsView.vue'
import SharedView from './views/SharedView.vue'
import ShopView from './views/ShopView.vue'
import SupplierEditView from './views/SupplierEditView.vue'
import WorkPlanView from './views/WorkPlanView.vue'

/** Tidiness only. The backend checks the admin key on every save. */
function adminOnly() {
  return useLibraryStore().adminOn || '/library'
}

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
          { path: 'purchase', name: 'purchase', component: PurchaseView },
        ],
      },
      { path: '/prices', component: PricesView },
      { path: '/prices/shop', component: ShopView },
      { path: '/prices/:flowerId', component: PriceFlowerView },
      { path: '/library', component: LibraryView },
      { path: '/library/designs/:designId', component: DesignEditView, beforeEnter: adminOnly },
      { path: '/library/flowers/:flowerId', component: FlowerEditView, beforeEnter: adminOnly },
      {
        path: '/library/suppliers/:supplierId',
        component: SupplierEditView,
        beforeEnter: adminOnly,
      },
      { path: '/settings', component: SettingsView },
      { path: '/shared/:shareId?', component: SharedView },
      { path: '/:pathMatch(.*)*', redirect: '/events' },
    ],
  })
}
