const PRODUCT_ID_BCD_LENGTH = 5;

const decodeBcdByte = (value: number): string | null => {
  const high = value >> 4;
  const low = value & 0x0f;
  return high <= 9 && low <= 9 ? `${high}${low}` : null;
};

/**
 * Decode the Product ID carried by the Watteco manufacturer data.
 *
 * The Bluetooth plugin exposes the company identifier as the object key, so
 * each DataView contains only the five BCD bytes following the CID.
 */
export function decodeAdvertisedProductId(
  manufacturerData?: Record<string, DataView>,
): string | null {
  if (!manufacturerData) return null;

  for (const data of Object.values(manufacturerData)) {
    if (data.byteLength !== PRODUCT_ID_BCD_LENGTH) continue;

    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const pairs = Array.from(bytes, decodeBcdByte);
    if (pairs.some(pair => pair === null)) continue;

    const digits = pairs.join('');
    if (digits === '0000000000') continue;

    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return null;
}
