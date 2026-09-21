import availableProductList from '../../public/config/AvailableProductList.json';
import mappingSource from '@/config/watteco-bacnet-mapping.csv?raw';

type Product = {
  name?: string | string[];
  file?: string;
  mId?: string[];
};

type MappingRow = Record<string, string>;

export type ProductMeasurement = {
  id: string;
  measId: number;
  name: string;
  unit: string;
  decimals: number;
};

export type AvailableProductChoice = {
  label: string;
  reference: string;
};

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ';' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
};

const getSection = (source: string, marker: string): MappingRow[] => {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  const start = lines.findIndex(line => line.trim().startsWith(`##${marker}`));
  if (start === -1) return [];

  const end = lines.findIndex((line, index) => index > start && line.trim().startsWith('##'));
  const section = lines.slice(start + 1, end === -1 ? undefined : end);
  const headers = parseCsvLine(section[0] ?? '').map(header => header.trim());

  return section.slice(1)
    .filter(line => line.trim() !== '')
    .map((line) => {
      const cells = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    });
};

const productContainsReference = (product: Product, reference: string): boolean => {
  const normalizedReference = reference.trim().toLowerCase();
  const names = Array.isArray(product.name) ? product.name : [product.name];
  return [product.file, ...names]
    .filter((value): value is string => typeof value === 'string')
    .some(value => value.toLowerCase().includes(normalizedReference));
};

const modelRows = getSection(mappingSource, 'models');
const objectRows = getSection(mappingSource, 'objects');

export const extractProductReference = (value?: string | null): string | null => (
  value?.match(/\d{2,3}(?:-\d{2,3}){2,}/)?.[0] ?? null
);

export const getAvailableProductChoices = (): AvailableProductChoice[] => (
  (availableProductList.products as Product[])
    .filter(product => product.mId?.some(Boolean))
    .map((product) => {
      const names = Array.isArray(product.name) ? product.name : [product.name];
      const reference = extractProductReference(product.file)
        ?? names.map(name => extractProductReference(name)).find(Boolean)
        ?? null;
      const label = names.find((name): name is string => typeof name === 'string')
        ?? product.file
        ?? reference;
      return reference && label ? { label, reference } : null;
    })
    .filter((product): product is AvailableProductChoice => product !== null)
    .sort((left, right) => left.label.localeCompare(right.label))
);

export const getProductMeasurements = (productReference?: string | null): ProductMeasurement[] => {
  if (!productReference) return [];

  const product = (availableProductList.products as Product[])
    .find(candidate => productContainsReference(candidate, productReference));
  const mIds = product?.mId?.filter(Boolean) ?? [];
  if (mIds.length === 0) return [];

  const models = new Set(modelRows
    .filter((model) => {
      const selectorMIds = [...model.selectors.matchAll(/\{\s*mId\s*:\s*([^}]+?)\s*\}/g)]
        .map(match => match[1].trim());
      return mIds.some(mId => selectorMIds.includes(mId));
    })
    .map(model => model.name.trim()));

  const measurements = new Map<number, ProductMeasurement>();
  for (const object of objectRows) {
    const belongsToProduct = object.models.split(',')
      .map(model => model.trim())
      .some(model => models.has(model));
    const measId = Number(object.measId);
    if (!belongsToProduct || !Number.isInteger(measId) || measurements.has(measId)) continue;

    measurements.set(measId, {
      id: object.id,
      measId,
      name: object.name || object.id,
      unit: object.units,
      decimals: Number.isInteger(Number(object.precision)) ? Number(object.precision) : 0,
    });
  }

  return [...measurements.values()];
};
