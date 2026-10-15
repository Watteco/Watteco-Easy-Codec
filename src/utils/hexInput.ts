export type FormattedHexInput = {
  value: string;
  cursor: number;
};

function countHexCharacters(value: string): number {
  return value.match(/[0-9a-f]/gi)?.length ?? 0;
}

function cursorAfterHexCharacters(value: string, count: number): number {
  if (count === 0) return 0;

  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (!/[0-9A-F]/.test(value[index])) continue;
    seen += 1;
    if (seen !== count) continue;

    const position = index + 1;
    return value[position] === ' ' ? position + 1 : position;
  }

  return value.length;
}

export function formatHexInput(value: string, cursor = value.length): FormattedHexInput {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const compact = value.replace(/[\s:-]/g, '');
  if (!/^[0-9a-f]*$/i.test(compact)) return { value, cursor: safeCursor };

  const hexCharactersBeforeCursor = countHexCharacters(value.slice(0, safeCursor));
  const formatted = compact
    .toUpperCase()
    .replace(/([0-9A-F]{2})(?=[0-9A-F])/g, '$1 ');

  return {
    value: formatted,
    cursor: cursorAfterHexCharacters(formatted, hexCharactersBeforeCursor),
  };
}
