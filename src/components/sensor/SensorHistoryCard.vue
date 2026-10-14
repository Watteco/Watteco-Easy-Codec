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
        v-if="hasChartPoints"
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
          <template v-for="seriesItem in chartSeries" :key="seriesItem.id">
            <path
              v-if="seriesItem.selected"
              class="chart-area"
              :d="seriesItem.areaPath"
              :style="{ '--series-accent': seriesItem.accent }"
            />
            <path
              class="chart-stroke"
              :class="{ 'chart-stroke--muted': !seriesItem.selected }"
              :d="seriesItem.linePath"
              :style="{ '--series-accent': seriesItem.accent }"
            />
          </template>
        </svg>
        <div class="chart-points">
          <template v-for="seriesItem in chartSeries" :key="seriesItem.id">
            <button
              v-for="(point, index) in seriesItem.points"
              :key="`${seriesItem.id}-${point.timestamp ?? point.sequence ?? index}-${index}`"
              type="button"
              class="chart-point"
              :class="{
                'chart-point--selected': selectedPoint?.seriesId === seriesItem.id && selectedPoint.index === index,
                'chart-point--muted': !seriesItem.selected,
              }"
              :style="{
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: `min(32px, ${point.hitWidth}%)`,
                '--series-accent': seriesItem.accent,
              }"
              :aria-label="formatPointDetails(point, index, seriesItem.label)"
              :aria-pressed="selectedPoint?.seriesId === seriesItem.id && selectedPoint.index === index"
              @click.stop="toggleSelectedPoint(seriesItem.id, index)"
            />
          </template>
          <div
            v-if="selectedPoint"
            class="chart-tooltip"
            :class="{
              'chart-tooltip--start': selectedPoint.point.x < 20,
              'chart-tooltip--end': selectedPoint.point.x > 80,
              'chart-tooltip--below': selectedPoint.point.y < 35,
            }"
            :style="{
              left: `${selectedPoint.point.x}%`,
              top: `${selectedPoint.point.y}%`,
              '--series-accent': selectedPoint.accent,
            }"
            role="status"
            aria-live="polite"
          >
            <strong>{{ formatValue(selectedPoint.point.value) }} {{ unit }}</strong>
            <span>{{ selectedPoint.label }} · {{ formatPointContext(selectedPoint.point, selectedPoint.index) }}</span>
          </div>
        </div>
        <div class="chart-axis">
          <span>{{ xAxisLabels[0] }}</span>
          <span>{{ xAxisLabels[1] }}</span>
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

type HistorySeries = {
  id: string;
  label: string;
  accent?: string;
  points: readonly HistoryPoint[];
};

const props = withDefaults(defineProps<{
  label: string;
  subtitle: string;
  emptyLabel: string;
  points?: readonly HistoryPoint[];
  series?: readonly HistorySeries[];
  selectedSeriesId?: string;
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
  points: () => [],
  series: () => [],
});
const emit = defineEmits<{
  (event: 'select-series', seriesId: string): void;
}>();

const selectedPointKey = ref<{ seriesId: string; index: number } | null>(null);

const normalizedSeries = computed(() => (
  props.series.length
    ? props.series
    : [{ id: 'default', label: props.label, accent: props.accent, points: props.points }]
));

const roundedSeries = computed(() => {
  const factor = 10 ** props.decimals;

  return normalizedSeries.value.map(seriesItem => ({
    ...seriesItem,
    points: seriesItem.points.map(point => ({
      ...point,
      value: Math.sign(point.value)
        * Math.round((Math.abs(point.value) + Number.EPSILON) * factor)
        / factor,
    })),
  }));
});

const roundedPoints = computed(() => roundedSeries.value.flatMap(seriesItem => seriesItem.points));

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

const positionPoints = (sourcePoints: readonly HistoryPoint[]) => {
  if (!sourcePoints.length) return [];
  const points = [...sourcePoints].sort((left, right) => (
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
  const sharedHorizontalValues = roundedPoints.value.map((point, index) => (
    props.xAxisMode === 'sequence'
      ? point.sequence ?? index + 1
      : point.timestamp ?? index
  ));
  const useSharedDomain = roundedSeries.value.length > 1 && sharedHorizontalValues.length > 1;
  const firstHorizontalValue = useSharedDomain
    ? Math.min(...sharedHorizontalValues)
    : horizontalValues[0];
  const lastHorizontalValue = useSharedDomain
    ? Math.max(...sharedHorizontalValues)
    : horizontalValues[horizontalValues.length - 1];
  const horizontalRange = lastHorizontalValue - firstHorizontalValue;

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
};

const chartSeries = computed(() => roundedSeries.value.map((seriesItem, seriesIndex) => {
  const points = positionPoints(seriesItem.points);
  const selected = props.selectedSeriesId
    ? seriesItem.id === props.selectedSeriesId
    : seriesIndex === 0;
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)?.x} 100 L ${points[0].x} 100 Z`
    : '';
  return {
    ...seriesItem,
    accent: seriesItem.accent ?? props.accent,
    points,
    selected,
    linePath,
    areaPath,
  };
}));

const chartPoints = computed(() => (
  chartSeries.value.find(seriesItem => seriesItem.points.length)?.points ?? []
));
const hasChartPoints = computed(() => chartSeries.value.some(seriesItem => seriesItem.points.length));

const lastPoint = computed(() => {
  const selectedSeries = chartSeries.value.find(seriesItem => seriesItem.selected);
  return selectedSeries ? selectedSeries.points.at(-1) : chartPoints.value.at(-1);
});
const selectedPoint = computed(() => (
  selectedPointKey.value === null
    ? undefined
    : (() => {
      const seriesItem = chartSeries.value.find(item => item.id === selectedPointKey.value?.seriesId);
      const point = seriesItem?.points[selectedPointKey.value.index];
      return seriesItem && point
        ? { ...selectedPointKey.value, point, label: seriesItem.label, accent: seriesItem.accent }
        : undefined;
    })()
));

watch([() => props.points, () => props.series], () => {
  selectedPointKey.value = null;
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

const xAxisLabels = computed(() => {
  if (!chartPoints.value.length) return ['', ''];
  if (props.xAxisMode === 'sequence' && roundedSeries.value.length > 1) {
    const sequences = roundedPoints.value.map((point, index) => point.sequence ?? index + 1);
    return [`#${Math.min(...sequences)}`, `#${Math.max(...sequences)}`];
  }
  return [
    formatXAxisLabel(chartPoints.value[0], 0),
    formatXAxisLabel(chartPoints.value.at(-1) ?? chartPoints.value[0], chartPoints.value.length - 1),
  ];
});

const formatPointContext = (point: HistoryPoint, index: number) => (
  props.xAxisMode === 'sequence'
    ? `#${point.sequence ?? index + 1}`
    : formatDetailsTimestamp(point.timestamp ?? 0)
);

const formatPointDetails = (point: HistoryPoint, index: number, seriesLabel: string) => (
  `${seriesLabel}, ${formatValue(point.value)} ${props.unit}, ${formatPointContext(point, index)}`
);

const toggleSelectedPoint = (seriesId: string, index: number) => {
  emit('select-series', seriesId);
  selectedPointKey.value = selectedPointKey.value?.seriesId === seriesId
    && selectedPointKey.value.index === index
    ? null
    : { seriesId, index };
};

const clearSelectedPoint = () => {
  selectedPointKey.value = null;
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
  fill: var(--series-accent, var(--history-accent));
  opacity: 0.1;
}

.chart-stroke {
  fill: none;
  stroke: var(--series-accent, var(--history-accent));
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.chart-stroke--muted { opacity: 0.32; }

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
  border: 2px solid var(--series-accent, var(--history-accent));
  border-radius: 50%;
  background: var(--app-surface);
  box-sizing: border-box;
  content: '';
  transform: translate(-50%, -50%);
  transition: width 120ms ease, height 120ms ease, background-color 120ms ease;
}

.chart-point--muted { opacity: 0.42; }

.chart-point:hover::after,
.chart-point:focus-visible::after,
.chart-point--selected::after {
  width: 12px;
  height: 12px;
  background: var(--series-accent, var(--history-accent));
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
  color: var(--series-accent, var(--history-accent));
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
