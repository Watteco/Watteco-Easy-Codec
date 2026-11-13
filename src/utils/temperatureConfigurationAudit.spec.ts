import { describe, expect, it } from 'vitest';
import hygro from '../../public/config/50-70-205-232-HygroTemp\'O.json';
import climo from '../../public/config/50-70-247-Clim\'O.json';
import remoteHygro from '../../public/config/50-70-200-RTH.json';
import tempo from '../../public/config/50-70-231-Temp\'O.json';
import rt1ctn from '../../public/config/50-70-043-003-RT1CTN.json';
import rt2ctn from '../../public/config/50-70-139-000-RT2CTN.json';
import pt1000 from '../../public/config/50-70-126-PT1000.json';
import pt1000HighTemperature from '../../public/config/50-70-288-PT1000-400C.json';
import outdoor from '../../public/config/50-70-164-RT.json';
import outdoorTwoProbes from '../../public/config/50-70-268-Temp\'O-Outdoor-1probe+1remote-probe.json';
import moveo from '../../public/config/50-70-225-Move\'o.json';
import vaqaoLite from '../../public/config/50-70-223-VAQAO Lt.json';
import pulseClassic from '../../public/config/50-70-014-PulseSenso.json';
import flasho from '../../public/config/50-70-071-Flasho.json';
import flashoThreeProbes from '../../public/config/50-70-206-Flash\'O-3-probes.json';
import vaqaoPlusLite from '../../public/config/50-70-251-VAQAO+Lt.json';
import fr from '../../public/localisation/fr_FR.json';
import en from '../../public/localisation/en_US.json';
import { buildConfigurationFieldHelp } from './configurationFieldHelp';
import { referencedFieldNames } from './patternReporting';
import { isSavedFieldValueValid } from './savedConfigurations';
import { encodeHexFrameValue } from './configurationFrameValue';

const configurations = [
  ['HygroTempO 205/232', hygro],
  ['ClimO 247', climo],
  ['HygroTempO remote 200', remoteHygro],
  ['TempO 231', tempo],
  ['TempO RT1CTN 043-003', rt1ctn],
  ['TempO RT2CTN 139', rt2ctn],
  ['PT1000 126', pt1000],
  ['PT1000 400C 288', pt1000HighTemperature],
  ['TempO Outdoor 164', outdoor],
  ['TempO Outdoor two probes 268', outdoorTwoProbes],
  ['MoveO 225', moveo],
  ['VAQAO Lite 223', vaqaoLite],
  ['Pulse Senso 014', pulseClassic],
  ['FlashO 071', flasho],
  ['FlashO three probes 206', flashoThreeProbes],
  ['VAQAO Plus Lite 251', vaqaoPlusLite],
] as const;

describe('audited sensor configurations', () => {
  it.each(configurations)('%s has valid defaults, dependencies and localized field help', (_, config) => {
    const help = buildConfigurationFieldHelp(config);
    for (const sectionName of ['general_params', 'batch_params', 'standard_params'] as const) {
      const section = config[sectionName];
      const groups = Object.entries(section).filter(([, group]) => 'fields' in group);
      const fields: Record<string, any> = {};
      for (const [, group] of groups) {
        for (const [name, field] of Object.entries((group as any).fields)) {
          expect(fields, name).not.toHaveProperty(name);
          fields[name] = field;
        }
      }
      for (const [groupName, group] of groups) {
        for (const [name, field] of Object.entries((group as any).fields) as [string, any][]) {
          if (field.default_value !== undefined) {
            expect(isSavedFieldValueValid(field.default_value, field), name).toBe(true);
          }
          if (field.type === 'timeVal') expect(field, name).not.toHaveProperty('step');
          if (sectionName === 'batch_params' && field.type === 'timeVal') {
            expect(field.max_value, name).toBe('1440');
            expect(isSavedFieldValueValid('1440', field), name).toBe(true);
          }
          if (field.depends_on) {
            const parent = sectionName === 'batch_params'
              ? fields[field.depends_on]
              : (group as any).fields[field.depends_on];
            expect(parent, name).toBeDefined();
            expect(Number(field.default_value), name).toBeLessThanOrEqual(Number(parent.default_value));
          }
          const descriptions = help[sectionName][groupName][name];
          expect(descriptions.length, name).toBeGreaterThan(0);
          for (const description of descriptions) {
            for (const token of description.match(/@[A-Za-z0-9_]+/g) ?? []) {
              expect(fr, name).toHaveProperty(token.slice(1));
              expect(en, name).toHaveProperty(token.slice(1));
            }
          }
          if (field.type === 'timeVal' && sectionName === 'standard_params') {
            expect(field.HMI.description, name).toMatch(/^@help/);
          }
        }
      }
      for (const [template] of section.cfg_block) {
        for (const [, placeholder] of template.matchAll(/\(([^)]+)\)/g)) {
          expect(referencedFieldNames(`(${placeholder})`, fields).size, placeholder).toBe(1);
        }
      }
      for (const entry of section.cfg_block) {
        for (const token of entry[1].match(/@[A-Za-z0-9_]+/g) ?? []) {
          expect(fr).toHaveProperty(token.slice(1));
          expect(en).toHaveProperty(token.slice(1));
        }
      }
    }
    expect(help.batch_params.global_params.gBatchEmission).toHaveLength(1);
  });

  it('allows the remote HygroTempO decimal threshold defaults on its slider grid', () => {
    const { standard_T_params, standard_H_params } = remoteHygro.standard_params;
    for (const field of [standard_T_params.fields.tNotification, standard_H_params.fields.hNotification]) {
      expect(Number(field.step)).toBe(0.1);
      for (const value of field.default_value.split(' ').map(Number)) {
        const index = (value - Number(field.min_value)) / Number(field.step);
        expect(index).toBeCloseTo(Math.round(index));
      }
    }
  });

  it('keeps the high-temperature PT1000 scale distinct from the other probes', () => {
    for (const config of [rt1ctn, rt2ctn, pt1000]) {
      const field = config.standard_params.standard_T_params.fields.tNotification;
      expect(field.HMI.multiplier).toBe('100');
      expect(encodeHexFrameValue('15.1', field.type, field.HMI.multiplier)).toBe('05e6');
    }
    const field = pt1000HighTemperature.standard_params.standard_T_params.fields.tNotification;
    expect(field.HMI.multiplier).toBe('10');
    expect(encodeHexFrameValue('15.1', field.type, field.HMI.multiplier)).toBe('0097');
  });

  it('keeps each RT2CTN standard probe associated with its own comment', () => {
    const help = buildConfigurationFieldHelp(rt2ctn);
    expect(help.standard_params.standard_T_params.tNotification)
      .toEqual(['@cfgCommentStandTemp - @probe 1']);
    expect(help.standard_params.standard_T2_params.t2Notification)
      .toEqual(['@cfgCommentStandTemp - @probe 2']);
    expect(help.batch_params.batch_T_params.tBatchEchant).toEqual(['@helpBatchTwoProbes']);
  });

  it.each([vaqaoLite, vaqaoPlusLite])('keeps VAQAO configuration %# threshold measurements independent of nonexistent emission controls', (config) => {
    for (const group of [config.standard_params.standard_T_params, config.standard_params.standard_H_params, config.standard_params.standard_C_params]) {
      for (const field of Object.values(group.fields)) {
        expect(field).not.toHaveProperty('depends_on');
      }
    }
    expect(config.standard_params.cfg_block.slice(0, 3).every(([frame]) => frame.includes('FFFF'))).toBe(true);
  });

  it('links the Outdoor report reset to its technical control without changing its wire bytes', () => {
    const template = outdoor.general_params.cfg_block[0][0];
    expect(template).toContain('(removeCurrentConfig)');
    expect(template.replace('(removeCurrentConfig)', '')).toBe('11 50 00 50 02 03');
  });

  it('preserves separate Outdoor probe associations and MoveO fixed occupancy sampling', () => {
    const help = buildConfigurationFieldHelp(outdoorTwoProbes);
    expect(help.standard_params.standard_T_params.tNotificationEp1).toEqual(['@cfgCommentStandTemp @forEp 1']);
    expect(help.standard_params.standard_T_params.tNotificationEp2).toEqual(['@cfgCommentStandTemp @forEp 2']);
    expect(moveo.batch_params.batch_O_params.fields.oBatchEchant.default_value).toBe('0001');
    const field = moveo.standard_params.standard_I_params.fields.iNotification;
    expect(Number(field.step)).toBe(1);
    for (const value of field.default_value.split(' ').map(Number)) {
      const index = (value - Number(field.min_value)) / Number(field.step);
      expect(index).toBe(Math.round(index));
    }
  });

  it('keeps counter batch help scoped to one or three inputs and each standard report to its own counter', () => {
    expect(buildConfigurationFieldHelp(flasho).batch_params.batch_P_params.pBatchEchant)
      .toEqual(['@helpBatchCounter']);
    for (const config of [pulseClassic, flashoThreeProbes]) {
      const help = buildConfigurationFieldHelp(config);
      expect(help.batch_params.batch_P_params.pBatchEchant).toEqual(['@helpBatchThreeCounters']);
      for (const input of [1, 2, 3]) {
        const descriptions = help.standard_params[`standard_P${input}_params`][`p${input}StandEmission`];
        expect(descriptions).toEqual(['@helpCounterEmission']);
        const templates = config.standard_params.cfg_block.filter(([frame]) => frame.includes(`(p${input}StandEmission)`));
        expect(templates).toHaveLength(1);
        expect(templates[0][1]).toBe(`@cfgCommentStandIndex @InputLabel ${input}`);
      }
    }
  });

  it('preserves VAQAO Plus fixed occupancy sampling and makes its illuminance defaults selectable', () => {
    expect(vaqaoPlusLite.batch_params.batch_O_params.fields.oBatchEchant.default_value).toBe('0001');
    const field = vaqaoPlusLite.standard_params.standard_I_params.fields.iNotification;
    for (const value of field.default_value.split(' ').map(Number)) {
      const index = (value - Number(field.min_value)) / Number(field.step);
      expect(index).toBe(Math.round(index));
    }
  });
});
