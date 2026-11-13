export type BinaryPatternState = 'ignored' | 'zero' | 'one';

const MIN_PATTERN_BITS = 1;
const MAX_PATTERN_BITS = 16;

export const normalizeBinaryPatternBitCount = (bitCount: number | string): number => {
  const parsed = Number.parseInt(String(bitCount), 10);
  if (!Number.isFinite(parsed)) return MIN_PATTERN_BITS;
  return Math.min(MAX_PATTERN_BITS, Math.max(MIN_PATTERN_BITS, parsed));
};

const parsePatternWord = (value: string | undefined): number => {
  if (!value) return 0;
  const trimmed = value.trim();
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return Number.parseInt(trimmed.slice(2), 16);
  if (!/^\d+$/.test(trimmed)) return 0;
  return Number.parseInt(trimmed, 10);
};

export const decodeBinaryPattern = (
  value: string | undefined,
  bitCount: number | string,
): BinaryPatternState[] => {
  const normalizedBitCount = normalizeBinaryPatternBitCount(bitCount);
  const [rawVal, rawGap] = String(value ?? '').trim().split(/\s+/);
  const val = parsePatternWord(rawVal);
  const gap = parsePatternWord(rawGap);

  return Array.from({ length: normalizedBitCount }, (_, bitIndex) => {
    const mask = 2 ** bitIndex;
    if ((gap & mask) === 0) return 'ignored';
    return (val & mask) === 0 ? 'zero' : 'one';
  });
};

export const encodeBinaryPattern = (
  states: readonly BinaryPatternState[],
): { val: number; gap: number; value: string } => {
  let val = 0;
  let gap = 0;

  states.slice(0, MAX_PATTERN_BITS).forEach((state, bitIndex) => {
    const mask = 2 ** bitIndex;
    if (state !== 'ignored') gap |= mask;
    if (state === 'one') val |= mask;
  });

  return { val, gap, value: `${val} ${gap}` };
};

export const formatBinaryPattern = (states: readonly BinaryPatternState[]): string => {
  const symbols: Record<BinaryPatternState, string> = {
    ignored: 'X',
    zero: '0',
    one: '1',
  };
  return `[${[...states].reverse().map(state => symbols[state]).join('')}]`;
};

export const formatBinaryPatternWord = (value: number): string => (
  value.toString(16).toUpperCase().padStart(4, '0')
);
