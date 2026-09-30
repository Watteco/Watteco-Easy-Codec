import {
  batteryHalfOutline,
  calculatorOutline,
  helpCircleOutline,
  thermometerOutline,
  waterOutline,
} from 'ionicons/icons';
import sensorVisualsConfig from '@/config/sensorVisuals.json';

const icons = {
  batteryHalfOutline,
  calculatorOutline,
  thermometerOutline,
  waterOutline,
} as const;

export type SensorVisual = {
  accent: string;
  icon: string;
  history: boolean;
  category?: string;
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
  category,
} of sensorVisualsConfig as SensorVisualGroup[]) {
  for (const id of ids) {
    sensorVisuals.set(id, { accent, icon, history, category });
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
    category: visual.category,
  };
};
