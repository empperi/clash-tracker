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

const formatValue = (val: number) => `${val} ${val === 1 ? 'War' : 'Wars'}`;
</script>

<template>
  <ThresholdSlider
    :model-value="props.modelValue"
    field="minWarParticipation"
    label="Min War Participation"
    :min="0"
    :max="20"
    help-text="Number of regular wars a member must participate in to qualify."
    :format-value="formatValue"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
