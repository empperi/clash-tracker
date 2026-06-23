<script setup lang="ts">
import ThresholdSlider from './ThresholdSlider.vue';

interface Props {
  modelValue: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'change', value: number): void;
}>();

const formatValue = (val: number) => `${val}%`;
</script>

<template>
  <ThresholdSlider
    :model-value="props.modelValue"
    field="acceptancePct"
    label="Acceptance Percentage"
    :min="0"
    :max="100"
    help-text="Minimum attack utilization expected from rostered members."
    :format-value="formatValue"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
