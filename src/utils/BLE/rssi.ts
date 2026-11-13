export type BleSignalLevel = 1 | 2 | 3 | 4;

export function getBleSignalLevel(rssi: number): BleSignalLevel {
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

export function getBleSignalPercent(rssi: number, minRssi = -100, maxRssi = -50): number {
  if (maxRssi <= minRssi) return 0;
  const clampedRssi = Math.min(maxRssi, Math.max(minRssi, rssi));
  return Math.round(((clampedRssi - minRssi) / (maxRssi - minRssi)) * 100);
}
