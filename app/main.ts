import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createAppRouter } from './router'
import { httpClient, setApiClient } from './api/client'
import { API_URL, APP_KEY } from './config'
import { dexiePriceStorage, dexieRepository } from './storage/dexie'
import { setPriceStorage } from './storage/priceStorage'
import { setEventRepository } from './storage/repository'
import './styles/main.css'
import './styles/print.css'

setEventRepository(dexieRepository())
setPriceStorage(dexiePriceStorage())
setApiClient(httpClient(API_URL, APP_KEY))

createApp(App).use(createPinia()).use(createAppRouter()).mount('#app')
