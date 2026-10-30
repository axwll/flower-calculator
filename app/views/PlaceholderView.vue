<script setup lang="ts">
defineProps<{ title: string; detail: string }>()
</script>

<template>
  <section class="page">
    <h1>{{ title }}</h1>
    <p class="muted">Coming later: {{ detail }}</p>
  </section>
</template>
