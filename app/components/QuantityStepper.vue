<script setup lang="ts">
defineProps<{ modelValue: number; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onChange(event: Event, current: number) {
  const input = event.target as HTMLInputElement
  if (/^\d+$/.test(input.value.trim())) emit('update:modelValue', Number(input.value))
  else input.value = String(current)
}
</script>

<template>
  <div class="stepper" role="group" :aria-label="label">
    <button
      class="stepper-button"
      type="button"
      :aria-label="`Fewer ${label}`"
      :disabled="modelValue <= 0"
      @click="emit('update:modelValue', modelValue - 1)"
    >
      −
    </button>
    <input
      class="stepper-input"
      type="text"
      inputmode="numeric"
      :aria-label="label"
      :value="modelValue"
      @change="onChange($event, modelValue)"
    />
    <button
      class="stepper-button"
      type="button"
      :aria-label="`More ${label}`"
      @click="emit('update:modelValue', modelValue + 1)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--muted);
  border-radius: var(--radius);
  background: var(--card);
  overflow: hidden;
}

.stepper-button {
  width: var(--tap);
  min-height: var(--tap);
  border: 0;
  background: var(--accent-soft);
  color: var(--accent);
  font: inherit;
  font-size: 1.3rem;
  cursor: pointer;
}

.stepper-button:disabled {
  background: var(--paper);
  color: var(--muted);
  cursor: default;
}

.stepper-input {
  width: 48px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: center;
}
</style>
