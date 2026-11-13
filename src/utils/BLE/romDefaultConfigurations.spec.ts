import { describe, expect, it } from 'vitest';
import hygroTempNeoConfig from '../../../public/config/50-70-260-671-HygroTemp\'O-Neo.json';
import pulseSensoNeoConfig from '../../../public/config/50-70-260-Pulse-Sens\'O-Neo.json';
import pulseSensoLiteNeoConfig from '../../../public/config/50-70-304-Pulse-Sens\'O-Lite-Neo.json';

const updatedRomConfigs = [
  pulseSensoNeoConfig,
  pulseSensoLiteNeoConfig,
  hygroTempNeoConfig,
];

describe('updated Neo ROM default configurations', () => {
  it('does not append the obsolete alternate configurations', () => {
    for (const config of updatedRomConfigs) {
      expect(config.blob_only_configurations).toEqual([]);
    }
  });

  it('removes existing reports and explicitly makes the new reports unconfirmed', () => {
    for (const config of updatedRomConfigs) {
      expect(config.general_params.remove_config.default_state).toBe('true');
      expect(config.general_params.confirmed.default_state).toBe('true');
      expect(config.general_params.confirmed.fields.confirmed.default_value).toBe('false');
    }
  });

  it('keeps Pulse SensO Neo input 4 optional and assigns it batch label 7', () => {
    expect(pulseSensoNeoConfig.batch_params.batch_P1_params.default_state).toBe('true');
    expect(pulseSensoNeoConfig.batch_params.batch_P4_params.default_state).toBe('false');
    expect(pulseSensoNeoConfig.batch_params.cfg_block).toContainEqual([
      '71 06 00 0F 1D 04 02 00 (p4BatchEchant) (gBatchEmission) 00 00 00 00 00 00 00 01 3C',
      '@cfgCommentBatchIndex @InputLabel 4',
    ]);
  });

  it('keeps the customer-specific batch state reports available but disabled', () => {
    expect([
      pulseSensoNeoConfig.batch_params.batch_S1_params.default_state,
      pulseSensoNeoConfig.batch_params.batch_S2_params.default_state,
      pulseSensoNeoConfig.batch_params.batch_S3_params.default_state,
      pulseSensoNeoConfig.batch_params.batch_S4_params.default_state,
      pulseSensoLiteNeoConfig.batch_params.batch_S_params.default_state,
      hygroTempNeoConfig.batch_params.batch_S_params.default_state,
    ]).toEqual(Array(6).fill('false'));

    expect(pulseSensoNeoConfig.batch_params.cfg_block).toEqual(expect.arrayContaining([
      ['11 06 000F 11 0055 00 (s1BatchEchant) (gBatchEmission) 00 01 1C', '@cfgCommentBatchState @InputLabel 1'],
      ['31 06 000F 11 0055 00 (s2BatchEchant) (gBatchEmission) 00 01 24', '@cfgCommentBatchState @InputLabel 2'],
      ['51 06 000F 11 0055 00 (s3BatchEchant) (gBatchEmission) 00 01 2C', '@cfgCommentBatchState @InputLabel 3'],
      ['71 06 000F 11 0055 00 (s4BatchEchant) (gBatchEmission) 00 01 44', '@cfgCommentBatchState @InputLabel 4'],
    ]));
    expect(pulseSensoLiteNeoConfig.batch_params.cfg_block).toContainEqual([
      '11 06 000F 11 0055 00 (sBatchEchant) (gBatchEmission) 00 01 1C',
      '@cfgCommentBatchState @InputLabel 1',
    ]);
    expect(hygroTempNeoConfig.batch_params.cfg_block).toContainEqual([
      '11 06 000F 11 0055 00 (sBatchEchant) (gBatchEmission) 00 01 1C',
      '@cfgCommentBatchState @InputLabel 1',
    ]);
  });
});
