import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

const FIXTURES_IMPORT = {
  group: ['**/fixtures/**'],
  message: 'fixtures/ is test data and must not be bundled into the app.',
}
const ENGINE_BOUNDARY_IMPORT = {
  group: [
    'vue',
    'vue/*',
    '@vue/*',
    'pinia',
    'pinia/*',
    'dexie',
    'dexie/*',
    '@/*',
    '**/app/**',
    '**/api/**',
  ],
  message: 'engine/ is pure logic and cannot depend on the UI, storage or API layers.',
}

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['app/**/__tests__/*', 'engine/**/*.test.ts'],
  },

  {
    name: 'app/no-fixtures',
    files: ['app/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [FIXTURES_IMPORT] }],
    },
  },

  {
    name: 'engine/boundary',
    files: ['engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ENGINE_BOUNDARY_IMPORT, FIXTURES_IMPORT] }],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'location',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'fetch',
        'XMLHttpRequest',
      ],
    },
  },

  {
    name: 'engine/tests-may-use-fixtures',
    files: ['engine/**/*.test.ts', 'engine/testkit/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ENGINE_BOUNDARY_IMPORT] }],
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
