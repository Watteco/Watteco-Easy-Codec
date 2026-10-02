import {
  batteryHalfOutline,
  helpCircleOutline,
  speedometerOutline,
  thermometerOutline,
  toggleOutline,
  waterOutline,
} from 'ionicons/icons';
import sensorVisualsConfig from '@/config/sensorVisuals.json';

const icons = {
  batteryHalfOutline,
  speedometerOutline,
  thermometerOutline,
  toggleOutline,
  waterOutline,
} as const;

export type SensorVisual = {
  accent: string;
  icon: string;
  history: boolean;
  historyMin?: number;
  historyMax?: number;
  category?: string;
  labelKey?: string;
  maxDecimals?: number;
  priority?: number;
  numbered?: boolean;
};

type SensorVisualGroup = Omit<SensorVisual, 'history'> & {
  ids: string[];
  history?: boolean;
};

const fallbackVisual: SensorVisual = {
  accent: '#888',
  icon: helpCircleOutline,
  history: false,
};

const sensorVisuals = new Map<string, SensorVisual>();

for (const {
  ids,
  accent,
  icon,
  history = false,
  historyMin,
  historyMax,
  category,
  labelKey,
  maxDecimals,
  priority,
  numbered,
} of sensorVisualsConfig as SensorVisualGroup[]) {
  for (const id of ids) {
    sensorVisuals.set(id, {
      accent,
      icon,
      history,
      historyMin,
      historyMax,
      category,
      labelKey,
      maxDecimals,
      priority,
      numbered,
    });
  }
}

export const hasSensorVisual = (id: string | number): boolean => sensorVisuals.has(String(id));

export const getSensorVisual = (id: string | number): SensorVisual => {
  const visual = sensorVisuals.get(String(id).split('#').at(-1) ?? '');

  if (!visual) return fallbackVisual;

  return {
    accent: visual.accent,
    icon: icons[visual.icon as keyof typeof icons] ?? fallbackVisual.icon,
    history: visual.history,
    historyMin: visual.historyMin,
    historyMax: visual.historyMax,
    category: visual.category,
    labelKey: visual.labelKey,
    maxDecimals: visual.maxDecimals,
    priority: visual.priority,
    numbered: visual.numbered,
  };
};

export const getSensorDisplayDecimals = (
  measurementDecimals: number,
  visual: SensorVisual,
): number => Math.min(measurementDecimals, visual.maxDecimals ?? measurementDecimals);

export const getSensorCardLabel = (
  measurementId: string,
  officialName: string,
  visual: SensorVisual,
  localize: (key: string) => string,
): string => {
  if (!visual.labelKey) return officialName;

  const shortName = localize(visual.labelKey);
  const instanceNumber = visual.numbered ? measurementId.match(/_(\d+)$/)?.[1] : undefined;

  return instanceNumber ? `${shortName} ${instanceNumber}` : shortName;
};
