export type TimeValueUnit = 'seconds' | 'minutes';

export interface TimeValue {
  unit: TimeValueUnit;
  value: number;
}

export const TIME_VALUE_UNIT_BIT = 0x8000;
export const TIME_VALUE_MAX = 0x7fff;

const isValidUnitValue = (value: number): boolean => (
  Number.isInteger(value) && value >= 0 && value <= TIME_VALUE_MAX
);

export function parseTimeValue(value: unknown): TimeValue | null {
  if (typeof value === 'number') {
    return isValidUnitValue(value) ? { unit: 'minutes', value } : null;
  }
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized) return null;

  const seconds = normalized.match(/^(\d+)(?:s|sec|secs|seconde|secondes|second|seconds)$/);
  if (seconds) {
    const parsed = Number(seconds[1]);
    return isValidUnitValue(parsed) ? { unit: 'seconds', value: parsed } : null;
  }

  const minutes = normalized.match(/^(\d+)(?:m|min|mins|minute|minutes)$/);
  if (minutes) {
    const parsed = Number(minutes[1]);
    return isValidUnitValue(parsed) ? { unit: 'minutes', value: parsed } : null;
  }

  const hoursAndMinutes = normalized.match(/^(\d+)h(?:(\d+)(?:m|min)?)?$/);
  if (hoursAndMinutes) {
    const parsed = Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2] ?? 0);
    return isValidUnitValue(parsed) ? { unit: 'minutes', value: parsed } : null;
  }

  const colonTime = normalized.match(/^(\d+):(\d{1,2})$/);
  if (colonTime && Number(colonTime[2]) < 60) {
    const parsed = Number(colonTime[1]) * 60 + Number(colonTime[2]);
    return isValidUnitValue(parsed) ? { unit: 'minutes', value: parsed } : null;
  }

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return isValidUnitValue(parsed) ? { unit: 'minutes', value: parsed } : null;
  }

  const compound = normalized.match(/^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)s(?:ec)?)$/);
  if (compound && (compound[1] || compound[2] || compound[3])) {
    const totalSeconds = Number(compound[1] ?? 0) * 3600
      + Number(compound[2] ?? 0) * 60
      + Number(compound[3] ?? 0);
    return isValidUnitValue(totalSeconds)
      ? { unit: 'seconds', value: totalSeconds }
      : null;
  }

  return null;
}

export function timeValueToSeconds(value: unknown): number | null {
  const parsed = parseTimeValue(value);
  if (!parsed) return null;
  return parsed.unit === 'seconds' ? parsed.value : parsed.value * 60;
}

export function formatTimeValueStorage(value: TimeValue): string {
  return value.unit === 'seconds' ? `${value.value}s` : String(value.value);
}

export function formatTimeValue(value: unknown): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return '0h00';
  if (parsed.unit === 'seconds') {
    if (parsed.value < 60) return `${parsed.value} s`;
    const minutes = Math.floor(parsed.value / 60);
    const seconds = parsed.value % 60;
    return seconds === 0 ? `${minutes} min` : `${minutes}m${String(seconds).padStart(2, '0')}s`;
  }
  const hours = Math.floor(parsed.value / 60);
  const minutes = parsed.value % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

export function encodeTimeValue(value: unknown): number | null {
  const parsed = parseTimeValue(value);
  if (!parsed) return null;
  return parsed.unit === 'minutes'
    ? parsed.value | TIME_VALUE_UNIT_BIT
    : parsed.value;
}

export function encodeTimeValueHex(value: unknown): string | null {
  const encoded = encodeTimeValue(value);
  return encoded === null ? null : encoded.toString(16).padStart(4, '0');
}

export function decodeTimeValue(rawValue: number): string | null {
  if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 0xffff) return null;
  return (rawValue & TIME_VALUE_UNIT_BIT) !== 0
    ? String(rawValue & TIME_VALUE_MAX)
    : `${rawValue}s`;
}
