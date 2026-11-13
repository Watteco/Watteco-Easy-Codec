/** Encode displayed numeric values, including paired thresholds, as frame integers. */
export function encodeHexFrameValue(
  value: string,
  type: string,
  multiplier?: string | number,
): string {
  const bytes = Number.parseInt(type.slice(3), 10);
  return value.trim().split(/\s+/).map(item => {
    const numericValue = Number(item);
    // Scale before rounding: parseInt would discard the displayed decimals.
    // Rounding also avoids losing one unit to floating-point multiplication.
    const encoded = multiplier === undefined
      ? Math.trunc(numericValue)
      : Math.round(numericValue * Number(multiplier));
    return encoded.toString(16).padStart(bytes * 2, '0');
  }).join(' ');
}
