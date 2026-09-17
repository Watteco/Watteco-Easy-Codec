<template>
  <ion-card class="history-card" :style="{ '--history-accent': accent }">
    <ion-card-content>
      <header class="history-header">
        <div>
          <h2>{{ label }}</h2>
          <p>{{ subtitle }}</p>
        </div>
        <div v-if="lastPoint" class="history-last-value">
          {{ formatValue(lastPoint.value) }}<small>{{ unit }}</small>
        </div>
      </header>

      <div v-if="normalizedPoints.length" class="chart">
        <div class="chart-grid" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div class="chart-bars" role="img" :aria-label="label">
          <div
            v-for="point in normalizedPoints"
            :key="point.timestamp"
            class="chart-bar-slot"
            :title="`${formatTimestamp(point.timestamp)} · ${formatValue(point.value)} ${unit}`"
          >
            <span class="chart-bar" :style="{ height: `${point.height}%` }" />
          </div>
        </div>
        <div class="chart-axis">
          <span>{{ formatTimestamp(normalizedPoints[0].timestamp) }}</span>
          <span>{{ formatTimestamp(normalizedPoints[normalizedPoints.length - 1].timestamp) }}</span>
        </div>
      </div>

      <div v-else class="chart-empty">
        <ion-icon :icon="barChartOutline" />
        <span>{{ emptyLabel }}</span>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonCard, IonCardContent, IonIcon } from '@ionic/vue';
import { barChartOutline } from 'ionicons/icons';

type HistoryPoint = {
  timestamp: number;
  value: number;
};

const props = withDefaults(defineProps<{
  label: string;
  subtitle: string;
  emptyLabel: string;
  points: HistoryPoint[];
  unit?: string;
  accent?: string;
  decimals?: number;
}>(), {
  unit: '',
  accent: '#F47B20',
  decimals: 0,
});

const lastPoint = computed(() => props.points.at(-1));

const normalizedPoints = computed(() => {
  if (!props.points.length) return [];

  const values = props.points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return props.points.map(point => ({
    ...point,
    height: 18 + ((point.value - min) / range) * 82,
  }));
});

const formatValue = (value: number) => value.toLocaleString(undefined, {
  minimumFractionDigits: props.decimals,
  maximumFractionDigits: props.decimals,
});

const formatTimestamp = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
}).format(timestamp);
</script>

<style scoped>
.history-card {
  --history-accent: #f47b20;
  grid-column: 1 / -1;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(28, 35, 45, 0.08);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 3px 12px rgba(28, 35, 45, 0.08);
}

.history-card ion-card-content {
  padding: 16px;
}

.history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.history-header h2 {
  margin: 0;
  color: #202631;
  font-size: 1rem;
  font-weight: 700;
}

.history-header p {
  margin: 4px 0 0;
  color: #858d96;
  font-size: 0.75rem;
}

.history-last-value {
  flex: 0 0 auto;
  color: var(--history-accent);
  font-size: 1.35rem;
  font-weight: 700;
}

.history-last-value small {
  margin-left: 3px;
  font-size: 0.72rem;
}

.chart {
  position: relative;
  height: 146px;
}

.chart-grid {
  position: absolute;
  inset: 0 0 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.chart-grid span {
  border-top: 1px dashed #e2e5e8;
}

.chart-bars {
  position: absolute;
  inset: 0 2px 22px;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 4px;
}

.chart-bar-slot {
  display: flex;
  height: 100%;
  flex: 1 1 0;
  align-items: flex-end;
  justify-content: center;
}

.chart-bar {
  width: min(72%, 22px);
  min-height: 4px;
  border-radius: 5px 5px 2px 2px;
  background: linear-gradient(to top, var(--history-accent), color-mix(in srgb, var(--history-accent) 62%, white));
  transition: height 180ms ease;
}

.chart-axis {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  color: #969da5;
  font-size: 0.68rem;
}

.chart-empty {
  display: flex;
  height: 124px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed #d9dde1;
  border-radius: 12px;
  color: #a0a7af;
  font-size: 0.8rem;
}

.chart-empty ion-icon {
  font-size: 28px;
}
</style>
