import availableProductList from '../../public/config/AvailableProductList.json';
import mappingSource from '@/config/watteco-bacnet-mapping.csv?raw';

type Product = {
  name?: string | string[];
  file?: string;
  mId?: string[];
  apps?: string[];
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

const getProductLabels = (product: Product): string[] => (
  (Array.isArray(product.name) ? product.name : [product.name])
    .filter((name): name is string => typeof name === 'string')
);

const labelContainsReference = (label: string, reference: string): boolean => {
  if (label.toLowerCase().includes(reference.toLowerCase())) return true;

  const parts = reference.split('-');
  if (parts.length < 3) return false;

  const family = `${parts[0]}-${parts[1]}-`;
  const productCode = parts[2];
  const groupStart = label.toLowerCase().indexOf(`${family.toLowerCase()}[`);
  if (groupStart === -1) return false;

  const groupedCodes = label.slice(groupStart + family.length + 1).split(']', 1)[0];
  return groupedCodes?.split(/[/,]/).map(code => code.trim()).includes(productCode) ?? false;
};

const cleanProductLabel = (label: string): string => (
  label
    .replace(/^\[Deprecated]\s*/i, '')
    .replace(/^BETA\s+/i, '')
    .replace(/\s*\(50-\d{2,3}[^)]*\).*$/i, '')
    .replace(/\s+50-\d{2,3}.*$/i, '')
    .trim()
);

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

export const getProductDisplayName = (productReference?: string | null): string | null => {
  if (!productReference) return null;

  const products = (availableProductList.products as Product[]);
  const product = products.find(candidate => (
    getProductLabels(candidate).some(label => labelContainsReference(label, productReference))
  )) ?? products.find(candidate => productContainsReference(candidate, productReference));
  const label = product ? getProductLabels(product)[0] : undefined;

  return label ? cleanProductLabel(label) : null;
};

export const getProductConfigurationFile = (productReference?: string | null): string | null => {
  if (!productReference) return null;

  const product = (availableProductList.products as Product[])
    .filter(candidate => candidate.apps?.includes('EasyCodec'))
    .find(candidate => productContainsReference(candidate, productReference));

  return product?.file ?? null;
};

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
