<template>
  <ion-card
    class="metric-card"
    :class="{ 'metric-card--compact': compact }"
    :style="{ '--metric-accent': accent }"
  >
    <ion-card-content>
      <div class="metric-heading">
        <span class="metric-icon" aria-hidden="true">
          <ion-icon :icon="icon" />
        </span>
        <span class="metric-label">{{ label }}</span>
      </div>

      <div class="metric-value" :class="{ 'metric-value--empty': value === null }">
        <span>{{ formattedValue }}</span>
        <small v-if="unit">{{ unit }}</small>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonCard, IonCardContent, IonIcon } from '@ionic/vue';

const props = withDefaults(defineProps<{
  label: string;
  value: number | string | null;
  unit?: string;
  icon: string;
  accent?: string;
  decimals?: number;
  compact?: boolean;
}>(), {
  unit: '',
  accent: '#7867B8',
  decimals: 0,
  compact: false,
});

const formattedValue = computed(() => {
  if (props.value === null) return '—';
  if (typeof props.value === 'number') {
    return props.value.toLocaleString(undefined, {
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals,
    });
  }
  return props.value;
});
</script>

<style scoped>
.metric-card {
  --metric-accent-soft: color-mix(in srgb, var(--metric-accent) 13%, transparent);
  position: relative;
  min-width: 0;
  min-height: 100px;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(28, 35, 45, 0.08);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 3px 12px rgba(28, 35, 45, 0.08);
}

.metric-card::before {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  background: var(--metric-accent);
  content: '';
}

.metric-card--compact {
  grid-column: 1 / -1;
  min-height: 72px;
}

.metric-card ion-card-content {
  display: flex;
  min-height: 100px;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px 14px;
}

.metric-card--compact ion-card-content {
  min-height: 72px;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding-right: 18px;
}

.metric-card--compact .metric-heading {
  flex: 1 1 auto;
}

.metric-card--compact .metric-value {
  flex: 0 0 auto;
  margin-inline-start: 0;
}

.metric-card--compact .metric-value span {
  font-size: 1.65rem;
}

.metric-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.metric-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--metric-accent-soft);
  color: var(--metric-accent);
  font-size: 19px;
}

.metric-label {
  overflow: hidden;
  color: #626b75;
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-inline-start: 3px;
  color: #202631;
  line-height: 1;
}

.metric-value span {
  overflow: hidden;
  font-size: clamp(1.75rem, 7vw, 2.4rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  text-overflow: ellipsis;
}

.metric-value small {
  color: #737c86;
  font-size: 0.88rem;
  font-weight: 600;
}

.metric-value--empty {
  color: #aeb4bb;
}
</style>
