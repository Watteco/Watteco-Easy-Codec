import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cataloguePath = resolve(root, 'public/config/AvailableProductList.json');
const outputDirectory = resolve(root, 'public/product-assets');
const apiRoot = 'https://support.watteco.com/api/produits';
const apiManifestUrl = `${apiRoot}/manifest.json`;
const imageMaximumSize = 320;
const imageQuality = 85;
const synchronizationConcurrency = 4;
const requestAttempts = 3;

const delay = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));

const fetchWithRetry = async url => {
  let response;
  for (let attempt = 1; attempt <= requestAttempts; attempt += 1) {
    response = await fetch(url);
    if (response.ok || (response.status !== 429 && response.status < 500)) return response;
    if (attempt < requestAttempts) await delay(300 * attempt);
  }
  return response;
};

const cleanName = value => (Array.isArray(value) ? value[0] : value)
  ?.replace(/^\[Deprecated]\s*/i, '')
  .replace(/^BETA\s+/i, '')
  .replace(/\s*\(50-\d{2,3}[^)]*\).*$/i, '')
  .trim();

const apiReferenceFor = product => (
  product.compatibleProducts.find(reference => reference.split('-').length === 3)
  ?? product.compatibleProducts
    .find(reference => reference.split('-').length === 4 && !/-67\d$/.test(reference))
    ?.split('-')
    .slice(0, 3)
    .join('-')
  ?? null
);

const fetchProduct = async product => {
  const requestedReference = apiReferenceFor(product);
  if (!requestedReference) throw new Error('no commercial API reference');
  const response = await fetchWithRetry(`${apiRoot}/${requestedReference}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const metadata = await response.json();
  let image = null;
  if (metadata.image) {
    const imageResponse = await fetchWithRetry(metadata.image);
    if (!imageResponse.ok) throw new Error(`image: ${imageResponse.status} ${imageResponse.statusText}`);
    const imageBuffer = await sharp(Buffer.from(await imageResponse.arrayBuffer()))
      .resize({
        width: imageMaximumSize,
        height: imageMaximumSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: imageQuality, alphaQuality: 100, effort: 6 })
      .toBuffer();
    const imageHash = createHash('sha256').update(imageBuffer).digest('hex').slice(0, 12);
    const imageName = `product-${imageHash}.webp`;
    await writeFile(resolve(outputDirectory, imageName), imageBuffer);
    image = `product-assets/${imageName}`;
  }

  return {
    product,
    requestedReference,
    synchronized: true,
    value: {
      name: metadata.nom,
      description: metadata.description ?? null,
      image,
      datasheets: {
        fr: metadata.datasheets?.fr?.url ?? null,
        en: metadata.datasheets?.en?.url ?? null,
      },
      support: metadata.support ?? null,
    },
  };
};

const main = async () => {
  const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8').then(value => value.replace(/^\uFEFF/, '')));
  const products = catalogue.products.filter(product => product.mId?.some(Boolean));
  await mkdir(outputDirectory, { recursive: true });
  const manifestPath = resolve(outputDirectory, 'manifest.json');
  const syncStatePath = resolve(outputDirectory, 'sync-state.json');
  const existingManifest = await readFile(manifestPath, 'utf8')
    .then(value => JSON.parse(value))
    .catch(() => ({}));
  const apiManifest = await fetchWithRetry(apiManifestUrl)
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);

  const synchronizeProduct = async product => {
    try {
      return await fetchProduct(product);
    } catch (error) {
      console.warn(`[product-assets] ${apiReferenceFor(product) ?? product.compatibleProducts[0]} skipped: ${error.message}`);
      const existingValue = product.compatibleProducts
        .map(reference => existingManifest[reference])
        .find(Boolean);
      return {
        product,
        requestedReference: apiReferenceFor(product),
        synchronized: false,
        value: existingValue ?? {
          name: cleanName(product.name) ?? product.compatibleProducts[0],
          description: null,
          image: null,
          datasheets: { fr: null, en: null },
          support: null,
        },
      };
    }
  };
  const results = new Array(products.length);
  let nextProductIndex = 0;
  await Promise.all(Array.from(
    { length: Math.min(synchronizationConcurrency, products.length) },
    async () => {
      while (nextProductIndex < products.length) {
        const productIndex = nextProductIndex;
        nextProductIndex += 1;
        results[productIndex] = await synchronizeProduct(products[productIndex]);
      }
    },
  ));

  const manifest = {};
  for (const result of results) {
    for (const reference of result.product.compatibleProducts) manifest[reference] = result.value;
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const referencedImages = new Set(Object.values(manifest)
    .map(value => value.image?.split('/').pop())
    .filter(Boolean));
  const obsoleteImages = (await readdir(outputDirectory))
    .filter(fileName => /\.(?:png|webp)$/i.test(fileName) && !referencedImages.has(fileName));
  await Promise.all(obsoleteImages.map(fileName => unlink(resolve(outputDirectory, fileName))));

  const failedPublishedReferences = results
    .filter(result => (
      !result.synchronized
      && result.requestedReference
      && apiManifest?.produits?.[result.requestedReference]
    ))
    .map(result => result.requestedReference);
  if (apiManifest?.revision && failedPublishedReferences.length === 0) {
    await writeFile(syncStatePath, `${JSON.stringify({
      schemaVersion: 1,
      revision: apiManifest.revision,
      lastModified: apiManifest.derniere_modification ?? null,
      synchronizedAt: new Date().toISOString(),
    }, null, 2)}\n`);
  } else if (failedPublishedReferences.length > 0) {
    console.warn(
      `[product-assets] Global revision not recorded because these products failed: ${failedPublishedReferences.join(', ')}`,
    );
  }

  console.log(
    `[product-assets] Wrote metadata for ${results.length} products and removed ${obsoleteImages.length} obsolete images.`,
  );
};

main().catch(error => {
  console.error('[product-assets] Synchronization failed:', error);
  process.exitCode = 1;
});
