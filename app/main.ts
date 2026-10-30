import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { createAppRouter } from './router'
import { dexieRepository } from './storage/dexie'
import { setEventRepository } from './storage/repository'
import './styles/main.css'
import './styles/print.css'

setEventRepository(dexieRepository())

createApp(App).use(createPinia()).use(createAppRouter()).mount('#app')
