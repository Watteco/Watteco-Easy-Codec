import { getProductMeasurements, type ProductMeasurement } from '@/utils/productMeasurements';
import { getSensorVisual, hasSensorVisual, type SensorVisual } from '@/utils/sensorVisuals';

export type SensorDashboardMeasurement = ProductMeasurement & {
  visual: SensorVisual;
};

export type SensorDashboardLayout = {
  visibleMeasurements: SensorDashboardMeasurement[];
  displayMeasurements: SensorDashboardMeasurement[];
  metricMeasurements: SensorDashboardMeasurement[];
  stateMeasurements: SensorDashboardMeasurement[];
  historyMeasurements: SensorDashboardMeasurement[];
};

export const getSensorDashboardLayout = (
  productReference?: string | null,
  darkMode = false,
): SensorDashboardLayout => {
  const visibleMeasurements = getProductMeasurements(productReference)
    .filter(measurement => hasSensorVisual(measurement.measId))
    .map(measurement => ({
      ...measurement,
      visual: getSensorVisual(measurement.measId, darkMode),
    }));
  const stateMeasurements = visibleMeasurements
    .filter(measurement => measurement.visual.category === 'state');
  const nonStateMeasurements = visibleMeasurements
    .filter(measurement => measurement.visual.category !== 'state');
  const batteryCount = nonStateMeasurements
    .filter(measurement => measurement.visual.category === 'battery')
    .length;

  return {
    visibleMeasurements,
    displayMeasurements: nonStateMeasurements,
    metricMeasurements: nonStateMeasurements.filter(measurement => (
      batteryCount !== 1 || measurement.visual.category !== 'battery'
    )),
    stateMeasurements,
    historyMeasurements: nonStateMeasurements
      .filter(measurement => measurement.visual.history),
  };
};
