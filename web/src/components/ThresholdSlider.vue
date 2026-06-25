<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useSession } from '../composables/useSession';
import { useQueryClient } from '@tanstack/vue-query';

interface Props {
  modelValue: number;
  field: 'acceptancePct' | 'minWarParticipation';
  label: string;
  min: number;
  max: number;
  helpText: string;
  formatValue: (val: number) => string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'change', value: number): void;
}>();

const { capabilities } = useSession();
const canEdit = computed(() => capabilities.value.canEditThresholds);

const localValue = ref(props.modelValue);

// Keep local value in sync with prop updates
watch(
  () => props.modelValue,
  (newVal) => {
    localValue.value = newVal;
  }
);

const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const queryClient = useQueryClient();

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(val: number) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(async () => {
    saveStatus.value = 'saving';
    try {
      const res = await fetch('/api/setThreshold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field: props.field,
          value: val,
        }),
      });

      if (res.ok) {
        saveStatus.value = 'saved';
        await queryClient.invalidateQueries({ queryKey: ['settings', 'thresholds'] });
        setTimeout(() => {
          if (saveStatus.value === 'saved') {
            saveStatus.value = 'idle';
          }
        }, 2000);
      } else {
        saveStatus.value = 'error';
      }
    } catch {
      saveStatus.value = 'error';
    }
  }, 500);
}

function onInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const val = Number(target.value);
  localValue.value = val;
  emit('update:modelValue', val);
  emit('change', val);
  debouncedSave(val);
}
</script>

<template>
  <div v-if="canEdit" class="ct-slider-item">
    <div class="slider-header">
      <label class="slider-label" :for="`${field}-slider`">{{ label }}</label>
      <span class="value-display">
        <span v-if="saveStatus === 'saving'" class="indicator saving">Saving...</span>
        <span v-else-if="saveStatus === 'saved'" class="indicator saved">Saved</span>
        <span v-else-if="saveStatus === 'error'" class="indicator error">Error</span>
        <span v-else>{{ formatValue(localValue) }}</span>
      </span>
    </div>
    
    <div class="slider-control">
      <input
        :id="`${field}-slider`"
        type="range"
        :min="min"
        :max="max"
        step="1"
        class="ct-slider"
        :value="localValue"
        @input="onInput"
      />
    </div>
    
    <p class="slider-help">{{ helpText }}</p>
  </div>
</template>

<style scoped>
.ct-slider-item {
  margin-bottom: var(--ct-spacing-lg);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ct-spacing-xs);
}

.slider-label {
  font-family: var(--ct-font-display);
  font-size: 15px;
  color: var(--ct-color-gold-text);
}

.value-display {
  font-family: var(--ct-font-display);
  font-weight: 600;
  font-size: 14px;
  color: var(--ct-color-text-primary);
}

.slider-control {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-md);
}

.ct-slider {
  flex: 1;
  accent-color: var(--ct-color-gold);
  height: 6px;
  border-radius: var(--ct-radius-sm);
  background: var(--ct-color-surface-well);
  outline: none;
}

.indicator {
  font-size: 12px;
  font-weight: 600;
  min-width: 60px;
}

.indicator.saving {
  color: var(--ct-color-text-secondary);
}

.indicator.saved {
  color: #4caf50;
}

.indicator.error {
  color: #f44336;
}

.slider-help {
  font-size: 12px;
  color: var(--ct-color-text-muted);
  margin: var(--ct-spacing-xs) 0 0 0;
}
</style>
