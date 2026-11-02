<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{ to: RouteLocationRaw; label: string }>()
</script>

<template>
  <RouterLink class="back-link no-print" :to="to">Back to {{ label }}</RouterLink>
</template>
