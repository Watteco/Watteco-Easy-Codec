import { describe, expect, it } from 'vitest';
import catalogue from '../../public/config/AvailableProductList.json';
import hygro from '../../public/config/50-70-205-232-HygroTemp\'O.json';
import { isSavedFieldValueValid } from './savedConfigurations';
import { encodeTimeValueHex } from './timeValue';
import { parseReportingConfigurations } from './BLE/reportingConfiguration';

const definitions = import.meta.glob<Record<string, any>>('../../public/config/*.json', {
  eager: true,
  import: 'default',
});
const files = [...new Set(catalogue.products
  .filter(product => product.apps.includes('EasyCodec'))
  .map(product => product.file))]
  .filter(file => !/236-Alt|291-Valv/.test(file));

describe('seconds for measurement and recording periods', () => {
  it.each(files)('%s allows seconds only for measurement/recording outside battery settings', (file) => {
    const config = definitions[`../../public/config/${file}.json`];
    expect(config, file).toBeDefined();
    for (const sectionName of ['batch_params', 'standard_params']) {
      for (const group of Object.values(config[sectionName] ?? {}) as any[]) {
        for (const [name, field] of Object.entries(group.fields ?? {}) as [string, any][]) {
          if (field.type !== 'timeVal') continue;
          const measurement = /@(echantLabel|measureLabel)\b/.test(field.HMI?.label ?? '');
          const battery = ['bBatchEchant', 'bStandEchant'].includes(name);
          const allowed = measurement && !battery;
          expect(field.HMI?.allow_seconds === true, name).toBe(allowed);
          expect(isSavedFieldValueValid('10s', field), name).toBe(allowed);
          expect(isSavedFieldValueValid(field.default_value, field), name).toBe(true);
        }
      }
    }
  });

  it('round-trips non-Neo temperature recording and measurement in seconds', () => {
    const recording = encodeTimeValueHex('10s');
    const measurement = encodeTimeValueHex('30s');
    const frame = (hex: string) => Uint8Array.from(
      hex.match(/[0-9a-f]{2}/gi)!.map(byte => Number.parseInt(byte, 16)),
    );
    const result = parseReportingConfigurations(hygro, [
      frame(`11 09 0402 00 15 0000 00 ${recording} 803C 0000 000A 02`),
      frame(`11 09 0402 00 80 0000 29 ${measurement} 803C 70 05DC 0000 01 71 0BB8 0000 01`),
    ]);
    expect(result.unmatchedFrames).toEqual([]);
    expect(result.unsupportedValues).toEqual([]);
    expect(result.fieldValues).toMatchObject({
      thBatchEchant: '10s', tStandEchant: '30s', gBatchEmission: '60', tStandEmission: '60',
    });
  });
});
