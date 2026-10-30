import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

/** Apps Script calls global functions by name, so these sit outside the bundle's scope. */
const GLOBALS = `
function doGet(e) { return FlowerApi.doGet(e) }
function doPost(e) { return FlowerApi.doPost(e) }
function onEdit(e) { return FlowerApi.onEdit(e) }
function setup() { return FlowerApi.setup() }
`

function appsScriptOutput(): Plugin {
  return {
    name: 'apps-script-output',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') file.code += GLOBALS
      }
      this.emitFile({
        type: 'asset',
        fileName: 'appsscript.json',
        source: readFileSync(new URL('./api/appsscript.json', import.meta.url)),
      })
    },
  }
}

// Builds api/src into the one file clasp pushes.
export default defineConfig({
  publicDir: false,
  plugins: [appsScriptOutput()],
  resolve: {
    alias: { '@engine': fileURLToPath(new URL('./engine/index.ts', import.meta.url)) },
  },
  build: {
    outDir: 'api/build',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: fileURLToPath(new URL('./api/src/main.ts', import.meta.url)),
      name: 'FlowerApi',
      formats: ['iife'],
      fileName: () => 'Code.js',
    },
  },
})
