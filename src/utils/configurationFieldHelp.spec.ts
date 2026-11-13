import { describe, expect, it } from 'vitest';
import { buildConfigurationFieldHelp } from './configurationFieldHelp';
import { referencedFieldNames } from './patternReporting';
import pulseConfig from '../../public/config/50-70-260-Pulse-Sens\'O-Neo.json';
import liteConfig from '../../public/config/50-70-304-Pulse-Sens\'O-Lite-Neo.json';
import tempoConfig from '../../public/config/50-70-306-Temp\'O-Neo-2-remote-probes.json';
import fr from '../../public/localisation/fr_FR.json';
import en from '../../public/localisation/en_US.json';

describe('configuration field help', () => {
  it('matches exact placeholders, resolves split values and deduplicates comments', () => {
    const index = buildConfigurationFieldHelp({
      batch_params: {
        input: { fields: { period: {}, threshold: {}, threshold1: {} } },
        global_params: { fields: { emission: {} } },
        cfg_block: [
          ['11 (period) (emission)', 'Input period'],
          ['11 (period)', 'Input period'],
          ['11 (periodExtra)', 'Unrelated field'],
          ['11 (threshold1)', 'Actual field ending in 1'],
          ['11 (threshold2)', 'Split threshold'],
          ['11 02 00', 'Fixed frame'],
          '11 (period)',
        ],
      },
    });
    expect(index.batch_params.input.period).toEqual(['Input period']);
    expect(index.batch_params.input.threshold).toEqual(['Split threshold']);
    expect(index.batch_params.input.threshold1).toEqual(['Actual field ending in 1']);
    expect(index.batch_params.global_params.emission).toEqual(['Input period']);
  });

  it('uses an explicit description first and allows an empty override to hide help', () => {
    const index = buildConfigurationFieldHelp({
      section: {
        group: { fields: {
          first: { HMI: { description: 'Specific help' } },
          second: { HMI: { description: '' } },
          third: {},
        } },
        cfg_block: [['(first) (second)', 'Automatic help']],
      },
    });
    expect(index.section.group).toEqual({ first: ['Specific help'], second: [], third: [] });
  });

  it('keeps sections isolated even if field names are reused', () => {
    const index = buildConfigurationFieldHelp({
      first: { group: { fields: { period: {} } }, cfg_block: [['(period)', 'First']] },
      second: { group: { fields: { period: {} } }, cfg_block: [['(period)', 'Second']] },
    });
    expect(index.first.group.period).toEqual(['First']);
    expect(index.second.group.period).toEqual(['Second']);
  });

  it.each([pulseConfig, liteConfig, tempoConfig])('audits Neo configuration %# fields and placeholders in both languages', (config) => {
    const index = buildConfigurationFieldHelp(config);
    for (const name of ['general_params', 'batch_params', 'standard_params'] as const) {
      const section = config[name];
      const groups = Object.entries(section).filter(([, value]) => 'fields' in value);
      const fields = Object.assign({}, ...groups.map(([, value]) => (value as any).fields));
      for (const [groupName, group] of groups) {
        for (const fieldName of Object.keys((group as any).fields)) {
          const descriptions = index[name][groupName][fieldName];
          expect(descriptions.length, fieldName).toBeGreaterThan(0);
          for (const description of descriptions) {
            for (const key of description.match(/@[A-Za-z0-9_]+/g) ?? []) {
              expect(fr, key).toHaveProperty(key.slice(1));
              expect(en, key).toHaveProperty(key.slice(1));
            }
          }
        }
      }
      for (const [template] of section.cfg_block) {
        for (const [, placeholder] of template.matchAll(/\(([^)]+)\)/g)) {
          expect(referencedFieldNames(`(${placeholder})`, fields).size, placeholder).toBe(1);
        }
      }
    }
  });

  it('keeps Pulse Neo help specific to the correct input and reporting mode', () => {
    const index = buildConfigurationFieldHelp(pulseConfig);
    expect(index.batch_params.batch_P1_params.p1BatchEchant)
      .toEqual(['@cfgCommentBatchIndex @InputLabel 1']);
    expect(index.batch_params.batch_P1_params.p1BatchEchant)
      .not.toContain('@cfgCommentBLEConfig');
    expect(index.batch_params.global_params.gBatchEmission).toEqual(['@helpBatchEmission']);
    expect(index.standard_params.standard_PMultiState_params.pMultiStatePattern)
      .toEqual(['@cfgCommentStandStatePattern @InputLabel 1 + @InputLabel 2 + @InputLabel 3 + @InputLabel 4']);
  });

  it.each([pulseConfig, liteConfig, tempoConfig])('uses progressive steps and day-long batch bounds in Neo configuration %#', (config) => {
    for (const sectionName of ['batch_params', 'standard_params'] as const) {
      for (const group of Object.values(config[sectionName])) {
        if (!('fields' in group)) continue;
        for (const field of Object.values(group.fields) as Record<string, unknown>[]) {
          expect(field).not.toHaveProperty('step');
          if (sectionName === 'batch_params' && field.type === 'timeVal') {
            expect(field.max_value).toBe('1440');
          }
        }
      }
    }
  });
});
