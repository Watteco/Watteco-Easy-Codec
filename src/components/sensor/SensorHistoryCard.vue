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

      <div v-if="chartPoints.length" class="chart">
        <div class="chart-y-axis" aria-hidden="true">
          <span>{{ formatAxisValue(scaleBounds.max) }}</span>
          <span>{{ formatAxisValue((scaleBounds.min + scaleBounds.max) / 2) }}</span>
          <span>{{ formatAxisValue(scaleBounds.min) }}</span>
        </div>
        <div class="chart-grid" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <svg
          class="chart-line"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          :aria-label="`${label}: ${formatAxisValue(scaleBounds.min)}–${formatAxisValue(scaleBounds.max)} ${unit}`"
        >
          <path class="chart-area" :d="areaPath" />
          <path class="chart-stroke" :d="linePath" />
        </svg>
        <div class="chart-points" aria-hidden="true">
          <span
            v-for="(point, index) in chartPoints"
            :key="`${point.timestamp}-${index}`"
            class="chart-point"
            :style="{ left: `${point.x}%`, top: `${point.y}%` }"
            :title="`${formatTimestamp(point.timestamp)} · ${formatValue(point.value)} ${unit}`"
          />
        </div>
        <div class="chart-axis">
          <span>{{ formatTimestamp(chartPoints[0].timestamp) }}</span>
          <span>{{ formatTimestamp(chartPoints[chartPoints.length - 1].timestamp) }}</span>
        </div>
      </div>

      <div v-else class="chart-empty">
        <ion-icon :icon="analyticsOutline" />
        <span>{{ emptyLabel }}</span>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonCard, IonCardContent, IonIcon } from '@ionic/vue';
import { analyticsOutline } from 'ionicons/icons';

type HistoryPoint = {
  timestamp: number;
  value: number;
};

const props = withDefaults(defineProps<{
  label: string;
  subtitle: string;
  emptyLabel: string;
  points: readonly HistoryPoint[];
  unit?: string;
  accent?: string;
  decimals?: number;
  minValue?: number;
  maxValue?: number;
}>(), {
  unit: '',
  accent: '#F47B20',
  decimals: 0,
});

const scaleBounds = computed(() => {
  if (!props.points.length) return { min: 0, max: 1 };

  const values = props.points.map(point => point.value);
  const automaticMin = Math.min(...values);
  const automaticMax = Math.max(...values);
  const configuredMin = Number.isFinite(props.minValue) ? props.minValue : undefined;
  const configuredMax = Number.isFinite(props.maxValue) ? props.maxValue : undefined;
  let min = configuredMin ?? automaticMin;
  let max = configuredMax ?? automaticMax;
  if (max <= min) {
    min = automaticMin;
    max = automaticMax;
  }

  return { min, max };
});

const chartPoints = computed(() => {
  if (!props.points.length) return [];

  const points = [...props.points].sort((left, right) => left.timestamp - right.timestamp);
  const { min, max } = scaleBounds.value;
  const valueRange = max - min || 1;
  const firstTimestamp = points[0].timestamp;
  const timeRange = points[points.length - 1].timestamp - firstTimestamp;

  return points.map((point, index) => ({
    ...point,
    x: timeRange
      ? 1.5 + ((point.timestamp - firstTimestamp) / timeRange) * 97
      : 50 + (index - (points.length - 1) / 2) * 3,
    y: Math.min(92, Math.max(8, 92 - ((point.value - min) / valueRange) * 84)),
  }));
});

const lastPoint = computed(() => chartPoints.value.at(-1));

const linePath = computed(() => chartPoints.value
  .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
  .join(' '));

const areaPath = computed(() => {
  const points = chartPoints.value;
  if (!points.length) return '';
  return `${linePath.value} L ${points.at(-1)?.x} 100 L ${points[0].x} 100 Z`;
});

const formatValue = (value: number) => value.toLocaleString(undefined, {
  minimumFractionDigits: props.decimals,
  maximumFractionDigits: props.decimals,
});

const formatAxisValue = (value: number) => value.toLocaleString(undefined, {
  maximumFractionDigits: Math.min(props.decimals, 1),
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
  inset: 0 0 22px 34px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.chart-grid span {
  border-top: 1px dashed #e2e5e8;
}

.chart-line {
  position: absolute;
  inset: 0 0 22px 34px;
  width: calc(100% - 34px);
  height: calc(100% - 22px);
  overflow: visible;
}

.chart-area {
  fill: var(--history-accent);
  opacity: 0.1;
}

.chart-stroke {
  fill: none;
  stroke: var(--history-accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.chart-points {
  position: absolute;
  inset: 0 0 22px 34px;
  pointer-events: none;
}

.chart-point {
  position: absolute;
  width: 7px;
  height: 7px;
  border: 2px solid var(--history-accent);
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
  transform: translate(-50%, -50%);
}

.chart-y-axis {
  position: absolute;
  top: -6px;
  bottom: 17px;
  left: 0;
  display: flex;
  width: 28px;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  color: #969da5;
  font-size: 0.64rem;
  line-height: 1;
}

.chart-axis {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 34px;
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
