export const WEB_SENSOR_QUERY_KEY = 'sensor';
export const EASY_CODEC_SELECTION_MESSAGE_TYPE = 'watteco.easy-codec.selection';

export type LinkableProduct = {
  file: string;
};

export type EasyCodecSelectionMessage = {
  type: typeof EASY_CODEC_SELECTION_MESSAGE_TYPE;
  sensor: string;
  configuration?: string;
};

// Keep the public identifier strategy in one place. It currently follows the
// configuration key already shared by the product catalog and Easy Codec.
export const getProductLinkIdentifier = (product: LinkableProduct): string => product.file;

export const readProductLinkIdentifier = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const identifier = value.trim();
  return identifier || null;
};

export const findProductByLinkIdentifier = <Product extends LinkableProduct>(
  products: Product[],
  identifier: string | null,
): Product | null => {
  if (!identifier) return null;
  return products.find(product => getProductLinkIdentifier(product) === identifier) ?? null;
};

export const createEasyCodecSelectionMessage = (
  sensor: string,
  configuration?: string | null,
): EasyCodecSelectionMessage => ({
  type: EASY_CODEC_SELECTION_MESSAGE_TYPE,
  sensor,
  ...(configuration !== undefined ? { configuration: configuration ?? '' } : {}),
});

export const getEmbeddingParentOrigin = (referrer: string): string | null => {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
};

export const buildWebConfigurationShareUrl = (
  currentUrl: string,
  sensor: string,
  hash: string,
  embeddingReferrer = '',
): string => {
  const directUrl = new URL(currentUrl);
  directUrl.searchParams.set(WEB_SENSOR_QUERY_KEY, sensor);
  directUrl.hash = hash;

  if (!getEmbeddingParentOrigin(embeddingReferrer)) return directUrl.href;

  const parentUrl = new URL(embeddingReferrer);
  const isLoraHost = parentUrl.hostname === 'lora.watteco.fr';
  const isLoraContainer = parentUrl.pathname.replace(/\/+$/, '') === '/Lora'
    || parentUrl.searchParams.get('tool') === 'easy-codec';
  if (!isLoraHost && !isLoraContainer) return directUrl.href;

  parentUrl.pathname = '/Lora/';
  parentUrl.search = '';
  parentUrl.searchParams.set('tool', 'easy-codec');
  parentUrl.searchParams.set(WEB_SENSOR_QUERY_KEY, sensor);
  // The portal drops this parameter after restoring the configuration. Reopening
  // the link then reloads the portal, even if the iframe's source still matches.
  parentUrl.searchParams.set('shared', '1');
  parentUrl.hash = hash;
  return parentUrl.href;
};
