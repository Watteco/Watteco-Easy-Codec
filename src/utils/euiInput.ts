export type EuiInputOptions = {
  byteLength?: number;
  fixedPrefix?: string;
};

function compactHex(value?: string): string {
  return value?.replace(/[^0-9A-F]/gi, '').toUpperCase() ?? '';
}

function getLengths(options: EuiInputOptions): {
  totalHexLength: number;
  prefix: string;
  editableHexLength: number;
} {
  const totalHexLength = Math.max(1, options.byteLength ?? 8) * 2;
  const prefix = compactHex(options.fixedPrefix).slice(0, totalHexLength);
  return {
    totalHexLength,
    prefix,
    editableHexLength: Math.max(0, totalHexLength - prefix.length),
  };
}

export function normalizeEuiInput(
  value?: string,
  options: EuiInputOptions = {},
): string {
  let normalized = compactHex(value);
  const { totalHexLength, prefix, editableHexLength } = getLengths(options);

  if (prefix && normalized.length === totalHexLength) {
    if (!normalized.startsWith(prefix)) return '';
    normalized = normalized.slice(prefix.length);
  }
  return normalized.slice(0, editableHexLength);
}

export function formatEuiInput(
  value?: string,
  options: EuiInputOptions = {},
): string {
  const normalized = normalizeEuiInput(value, options);
  return normalized.match(/.{1,2}/g)?.join(':') ?? '';
}

export function formatEuiPrefix(value?: string): string {
  const normalized = compactHex(value);
  return normalized.match(/.{1,2}/g)?.join(':') ?? '';
}

export function getFormattedEuiInputCaret(
  value: string,
  selectionStart: number | null,
  options: EuiInputOptions = {},
): number {
  const caret = selectionStart ?? value.length;
  const compactValue = compactHex(value);
  const hexBeforeCaret = compactHex(value.slice(0, caret)).length;
  const { totalHexLength, prefix } = getLengths(options);
  const pastedFullEui = Boolean(prefix)
    && compactValue.length === totalHexLength
    && compactValue.startsWith(prefix);
  const editableHexBeforeCaret = pastedFullEui
    ? Math.max(0, hexBeforeCaret - prefix.length)
    : hexBeforeCaret;
  const editableLength = normalizeEuiInput(value, options).length;
  const boundedHexCount = Math.min(editableHexBeforeCaret, editableLength);

  if (boundedHexCount === 0) return 0;
  return boundedHexCount + Math.floor((boundedHexCount - 1) / 2);
}

export function isCompleteEuiInput(
  value?: string,
  options: EuiInputOptions = {},
): boolean {
  const { editableHexLength } = getLengths(options);
  return normalizeEuiInput(value, options).length === editableHexLength;
}

