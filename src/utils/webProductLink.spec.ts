import { describe, expect, it } from 'vitest';
import {
  EASY_CODEC_SELECTION_MESSAGE_TYPE,
  createEasyCodecSelectionMessage,
  findProductByLinkIdentifier,
  getEmbeddingParentOrigin,
  getProductLinkIdentifier,
  readProductLinkIdentifier,
} from '@/utils/webProductLink';

describe('webProductLink', () => {
  const products = [
    { file: "50-70-205-232-HygroTemp'O", name: "HygroTemp'O" },
    { file: '50-70-080-Modbus', name: 'Modbus' },
  ];

  it('uses the configuration file key as the current public identifier', () => {
    expect(getProductLinkIdentifier(products[0])).toBe("50-70-205-232-HygroTemp'O");
  });

  it('reads one non-empty query value', () => {
    expect(readProductLinkIdentifier(' 50-70-080-Modbus ')).toBe('50-70-080-Modbus');
    expect(readProductLinkIdentifier(['50-70-080-Modbus'])).toBeNull();
    expect(readProductLinkIdentifier('')).toBeNull();
  });

  it('only resolves an exact known product identifier', () => {
    expect(findProductByLinkIdentifier(products, '50-70-080-Modbus')).toEqual(products[1]);
    expect(findProductByLinkIdentifier(products, '../AvailableProductList')).toBeNull();
    expect(findProductByLinkIdentifier(products, null)).toBeNull();
  });

  it('builds the selection message contract', () => {
    expect(createEasyCodecSelectionMessage('50-70-080-Modbus')).toEqual({
      type: EASY_CODEC_SELECTION_MESSAGE_TYPE,
      sensor: '50-70-080-Modbus',
    });
    expect(createEasyCodecSelectionMessage('50-70-080-Modbus', 'v1.abc')).toEqual({
      type: EASY_CODEC_SELECTION_MESSAGE_TYPE,
      sensor: '50-70-080-Modbus',
      configuration: 'v1.abc',
    });
    expect(createEasyCodecSelectionMessage('50-70-080-Modbus', null)).toEqual({
      type: EASY_CODEC_SELECTION_MESSAGE_TYPE,
      sensor: '50-70-080-Modbus',
      configuration: '',
    });
  });

  it('derives an exact HTTP origin from the embedding page', () => {
    expect(getEmbeddingParentOrigin('https://lora.watteco.fr/Lora/?tool=easy-codec'))
      .toBe('https://lora.watteco.fr');
    expect(getEmbeddingParentOrigin('http://localhost:5173/container'))
      .toBe('http://localhost:5173');
    expect(getEmbeddingParentOrigin('javascript:alert(1)')).toBeNull();
    expect(getEmbeddingParentOrigin('not a URL')).toBeNull();
  });
});
