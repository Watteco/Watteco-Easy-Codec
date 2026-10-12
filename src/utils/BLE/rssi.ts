export type BleSignalLevel = 1 | 2 | 3 | 4;

export function getBleSignalLevel(rssi: number): BleSignalLevel {
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
}
