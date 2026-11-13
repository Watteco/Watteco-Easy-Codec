const COUNTER_SET_SUFFIX = [0x02, 0x00, 0x0f, 0x04, 0x02, 0x23] as const;

export const MAX_COUNTER_VALUE = 0xffffffff;

export function parseCounterValue(value: unknown): number | null {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed <= MAX_COUNTER_VALUE ? parsed : null;
}

export function getCounterEndpoint(measurementId: string): number | null {
  if (measurementId === 'index') return 0;

  const match = /^index_(\d+)$/.exec(measurementId);
  if (!match) return null;

  const endpoint = Number(match[1]) - 1;
  return Number.isInteger(endpoint) && endpoint >= 0 && endpoint <= 9 ? endpoint : null;
}

export function buildCounterSetFrame(endpoint: number, value: number): Uint8Array | null {
  if (!Number.isInteger(endpoint) || endpoint < 0 || endpoint > 9) return null;
  if (!Number.isInteger(value) || value < 0 || value > MAX_COUNTER_VALUE) return null;

  const endpointControl = 0x11 + ((endpoint % 8) * 0x20) + (Math.floor(endpoint / 8) * 0x02);
  return Uint8Array.from([
    endpointControl,
    ...COUNTER_SET_SUFFIX,
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}
