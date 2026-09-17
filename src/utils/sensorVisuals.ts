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
};

type SensorVisualGroup = SensorVisual & {
  ids: string[];
};

const fallbackVisual: SensorVisual = {
  accent: '#888',
  icon: helpCircleOutline,
};

const sensorVisuals = new Map<string, SensorVisual>();

for (const { ids, accent, icon } of sensorVisualsConfig as SensorVisualGroup[]) {
  for (const id of ids) {
    sensorVisuals.set(id, { accent, icon });
  }
}

export const getSensorVisual = (id: string): SensorVisual => {
  const visual = sensorVisuals.get(id);

  if (!visual) return fallbackVisual;

  return {
    accent: visual.accent,
    icon: icons[visual.icon as keyof typeof icons] ?? fallbackVisual.icon,
  };
};
