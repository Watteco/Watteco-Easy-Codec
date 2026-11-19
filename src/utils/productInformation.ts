import manifestSource from '../../public/product-assets/manifest.json';

export type ProductInformation = {
  name: string;
  description: string | null;
  image: string | null;
  datasheets: {
    fr: string | null;
    en: string | null;
  };
  support: string | null;
};

const manifest = manifestSource as Record<string, ProductInformation>;

export const getProductInformation = (
  productReference?: string | null,
): ProductInformation | null => {
  if (!productReference) return null;
  if (manifest[productReference]) return manifest[productReference];

  const familyReference = productReference.split('-').slice(0, 3).join('-');
  return manifest[familyReference] ?? null;
};

export const getBundledProductImageUrl = (image?: string | null): string | null => (
  image ? `${import.meta.env.BASE_URL}${image}` : null
);
