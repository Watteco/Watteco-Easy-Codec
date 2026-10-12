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

      <div
        v-if="chartPoints.length"
        class="chart"
        @click="clearSelectedPoint"
        @keydown.esc="clearSelectedPoint"
      >
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
        <div class="chart-points">
          <button
            v-for="(point, index) in chartPoints"
            :key="`${point.timestamp ?? point.sequence ?? index}-${index}`"
            type="button"
            class="chart-point"
            :class="{ 'chart-point--selected': selectedPointIndex === index }"
            :style="{
              left: `${point.x}%`,
              top: `${point.y}%`,
              width: `min(32px, ${point.hitWidth}%)`,
            }"
            :aria-label="formatPointDetails(point, index)"
            :aria-pressed="selectedPointIndex === index"
            @click.stop="toggleSelectedPoint(index)"
          />
          <div
            v-if="selectedPoint"
            class="chart-tooltip"
            :class="{
              'chart-tooltip--start': selectedPoint.x < 20,
              'chart-tooltip--end': selectedPoint.x > 80,
              'chart-tooltip--below': selectedPoint.y < 35,
            }"
            :style="{ left: `${selectedPoint.x}%`, top: `${selectedPoint.y}%` }"
            role="status"
            aria-live="polite"
          >
            <strong>{{ formatValue(selectedPoint.value) }} {{ unit }}</strong>
            <span>{{ formatPointContext(selectedPoint, selectedPointIndex ?? 0) }}</span>
          </div>
        </div>
        <div class="chart-axis">
          <span>{{ formatXAxisLabel(chartPoints[0], 0) }}</span>
          <span>{{ formatXAxisLabel(chartPoints[chartPoints.length - 1], chartPoints.length - 1) }}</span>
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
import { computed, ref, watch } from 'vue';
import { IonCard, IonCardContent, IonIcon } from '@ionic/vue';
import { analyticsOutline } from 'ionicons/icons';

type HistoryPoint = {
  timestamp?: number;
  sequence?: number;
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
  xAxisMode?: 'time' | 'sequence';
}>(), {
  unit: '',
  accent: '#F47B20',
  decimals: 0,
  xAxisMode: 'time',
});

const selectedPointIndex = ref<number | null>(null);

const roundedPoints = computed(() => {
  const factor = 10 ** props.decimals;

  return props.points.map(point => ({
    ...point,
    value: Math.sign(point.value)
      * Math.round((Math.abs(point.value) + Number.EPSILON) * factor)
      / factor,
  }));
});

const scaleBounds = computed(() => {
  if (!roundedPoints.value.length) return { min: 0, max: 1 };

  const values = roundedPoints.value.map(point => point.value);
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
  const precisionStep = 10 ** -props.decimals;
  if (max - min < precisionStep * 2) {
    const middle = Math.round(((min + max) / 2) / precisionStep) * precisionStep;
    min = middle - precisionStep;
    max = middle + precisionStep;
  }

  return { min, max };
});

const chartPoints = computed(() => {
  if (!roundedPoints.value.length) return [];

  const points = [...roundedPoints.value].sort((left, right) => (
    props.xAxisMode === 'sequence'
      ? (left.sequence ?? 0) - (right.sequence ?? 0)
      : (left.timestamp ?? 0) - (right.timestamp ?? 0)
  ));
  const { min, max } = scaleBounds.value;
  const valueRange = max - min || 1;
  const horizontalValues = points.map((point, index) => (
    props.xAxisMode === 'sequence'
      ? point.sequence ?? index + 1
      : point.timestamp ?? index
  ));
  const firstHorizontalValue = horizontalValues[0];
  const horizontalRange = horizontalValues[horizontalValues.length - 1] - firstHorizontalValue;

  const positionedPoints = points.map((point, index) => ({
    ...point,
    x: horizontalRange
      ? 1.5 + ((horizontalValues[index] - firstHorizontalValue) / horizontalRange) * 97
      : 50 + (index - (points.length - 1) / 2) * 3,
    y: Math.min(92, Math.max(8, 92 - ((point.value - min) / valueRange) * 84)),
  }));

  return positionedPoints.map((point, index) => ({
    ...point,
    hitWidth: Math.max(1, Math.min(
      index ? point.x - positionedPoints[index - 1].x : Number.POSITIVE_INFINITY,
      index < positionedPoints.length - 1
        ? positionedPoints[index + 1].x - point.x
        : Number.POSITIVE_INFINITY,
      100,
    )),
  }));
});

const lastPoint = computed(() => chartPoints.value.at(-1));
const selectedPoint = computed(() => (
  selectedPointIndex.value === null
    ? undefined
    : chartPoints.value[selectedPointIndex.value]
));

watch(() => props.points, () => {
  selectedPointIndex.value = null;
});

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
  maximumFractionDigits: props.decimals,
});

const formatTimestamp = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
}).format(timestamp);

const formatDetailsTimestamp = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
}).format(timestamp);

const formatXAxisLabel = (point: HistoryPoint, index: number) => (
  props.xAxisMode === 'sequence'
    ? `#${point.sequence ?? index + 1}`
    : formatTimestamp(point.timestamp ?? 0)
);

const formatPointContext = (point: HistoryPoint, index: number) => (
  props.xAxisMode === 'sequence'
    ? `#${point.sequence ?? index + 1}`
    : formatDetailsTimestamp(point.timestamp ?? 0)
);

const formatPointDetails = (point: HistoryPoint, index: number) => (
  `${formatValue(point.value)} ${props.unit}, ${formatPointContext(point, index)}`
);

const toggleSelectedPoint = (index: number) => {
  selectedPointIndex.value = selectedPointIndex.value === index ? null : index;
};

const clearSelectedPoint = () => {
  selectedPointIndex.value = null;
};
</script>

<style scoped>
.history-card {
  --history-accent: #f47b20;
  grid-column: 1 / -1;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
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
  color: var(--app-text);
  font-size: 1rem;
  font-weight: 700;
}

.history-header p {
  margin: 4px 0 0;
  color: var(--app-text-muted);
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
  border-top: 1px dashed var(--app-chart-grid);
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
  z-index: 1;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  appearance: none;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  touch-action: manipulation;
  transform: translate(-50%, -50%);
}

.chart-point::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  border: 2px solid var(--history-accent);
  border-radius: 50%;
  background: var(--app-surface);
  box-sizing: border-box;
  content: '';
  transform: translate(-50%, -50%);
  transition: width 120ms ease, height 120ms ease, background-color 120ms ease;
}

.chart-point:hover::after,
.chart-point:focus-visible::after,
.chart-point--selected::after {
  width: 12px;
  height: 12px;
  background: var(--history-accent);
}

.chart-point:focus-visible {
  outline: 2px solid var(--history-accent);
  outline-offset: -5px;
}

.chart-point--selected {
  z-index: 3;
}

.chart-tooltip {
  --tooltip-translate-x: -50%;
  --tooltip-translate-y: calc(-100% - 10px);
  position: absolute;
  z-index: 2;
  display: flex;
  max-width: calc(100% - 8px);
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
  color: var(--app-text);
  font-size: 0.72rem;
  line-height: 1.25;
  pointer-events: none;
  transform: translate(var(--tooltip-translate-x), var(--tooltip-translate-y));
  white-space: nowrap;
}

.chart-tooltip strong {
  color: var(--history-accent);
  font-size: 0.8rem;
}

.chart-tooltip span {
  color: var(--app-text-secondary);
}

.chart-tooltip--start {
  --tooltip-translate-x: 0;
}

.chart-tooltip--end {
  --tooltip-translate-x: -100%;
}

.chart-tooltip--below {
  --tooltip-translate-y: 10px;
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
  color: var(--app-text-faint);
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
  color: var(--app-text-faint);
  font-size: 0.68rem;
}

.chart-empty {
  display: flex;
  height: 124px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--app-border-strong);
  border-radius: 12px;
  color: var(--app-text-faint);
  font-size: 0.8rem;
}

.chart-empty ion-icon {
  font-size: 28px;
}
</style>
