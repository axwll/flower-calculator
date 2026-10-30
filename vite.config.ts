import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: '/flower-calculator/',
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      includeManifestIcons: false,
      manifest: {
        name: 'Flower Calculator',
        short_name: 'Flowers',
        description: 'Turn flower recipes and prices into an event estimate and work plan.',
        lang: 'en-GB',
        display: 'standalone',
        theme_color: '#7a3b52',
        background_color: '#faf7f2',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png}'] },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app', import.meta.url)),
      '@engine': fileURLToPath(new URL('./engine/index.ts', import.meta.url)),
    },
  },
})
