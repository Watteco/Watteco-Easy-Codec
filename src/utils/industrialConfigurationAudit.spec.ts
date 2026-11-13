import { describe, expect, it } from 'vitest';
import modbus from '../../public/config/50-70-080-Modbus.json';
import modbusField from '../../public/config/50-70-287-Modbus-Field.json';
import ventilo from '../../public/config/50-70-101-Ventil\'O.json';
import fr from '../../public/localisation/fr_FR.json';
import en from '../../public/localisation/en_US.json';
import { buildConfigurationFieldHelp } from './configurationFieldHelp';
import { referencedFieldNames } from './patternReporting';
import { CONFIGURATION_SECTION_NAMES, isSavedFieldValueValid } from './savedConfigurations';

const configurations = [['Modbus', modbus], ['Modbus Field', modbusField], ['VentilO', ventilo]] as const;

describe('industrial configuration audit', () => {
  it.each(configurations)('%s has valid defaults, dependencies and localized help', (_, config) => {
    const help = buildConfigurationFieldHelp(config);
    for (const sectionName of CONFIGURATION_SECTION_NAMES) {
      const section = (config as Record<string, any>)[sectionName];
      if (!section) continue;
      const groups = Object.entries(section).filter(([, group]) => (
        !!group && typeof group === 'object' && 'fields' in group
      )) as [string, { fields: Record<string, any> }][];
      const fields: Record<string, any> = {};
      for (const [, group] of groups) {
        for (const [name, field] of Object.entries(group.fields)) {
          expect(fields, name).not.toHaveProperty(name);
          fields[name] = field;
        }
      }
      for (const [groupName, group] of groups) {
        for (const [name, field] of Object.entries(group.fields)) {
          if (field.default_value !== undefined) {
            expect(isSavedFieldValueValid(field.default_value, field), name).toBe(true);
          }
          if (field.type === 'timeVal') expect(field, name).not.toHaveProperty('step');
          if (field.depends_on) {
            const parent = sectionName === 'batch_params'
              ? section.global_params.fields[field.depends_on]
              : group.fields[field.depends_on];
            expect(parent, name).toBeDefined();
            expect(Number(field.default_value)).toBeLessThanOrEqual(Number(parent.default_value));
          }
          const descriptions = help[sectionName][groupName][name];
          expect(descriptions.length, name).toBeGreaterThan(0);
          for (const description of [field.HMI.label, ...descriptions]) {
            for (const token of description.match(/@[A-Za-z0-9_]+/g) ?? []) {
              expect(fr, name).toHaveProperty(token.slice(1));
              expect(en, name).toHaveProperty(token.slice(1));
            }
          }
        }
      }
      for (const [template, description] of section.cfg_block) {
        for (const [, placeholder] of template.matchAll(/\(([^)]+)\)/g)) {
          if (referencedFieldNames(`(${placeholder})`, fields).size) continue;
          // Modbus requests are assembled by their dedicated frame generator.
          expect(sectionName).toBe('modbus_params');
          expect(placeholder).toMatch(/^modbusFrame[0-9a-f]+$/);
          expect(section[placeholder]?.fields, placeholder).toBeDefined();
        }
        for (const token of description.match(/@[A-Za-z0-9_]+/g) ?? []) {
          expect(fr).toHaveProperty(token.slice(1));
          expect(en).toHaveProperty(token.slice(1));
        }
      }
    }
  });

  it.each([modbus, modbusField])('explains every generated request field in Modbus configuration %#', (config) => {
    const help = buildConfigurationFieldHelp(config);
    for (const [name, group] of Object.entries(config.modbus_params)) {
      if (!name.startsWith('modbusFrame') || !('fields' in group)) continue;
      const id = name.slice('modbusFrame'.length);
      expect(help.modbus_params[name][`mb${id}Slave`]).toEqual(['@helpModbusSlave']);
      expect(help.modbus_params[name][`mb${id}FunctionCode`]).toEqual(['@helpModbusFunction']);
      expect(help.modbus_params[name][`mb${id}StartAddress`]).toEqual(['@helpModbusStartAddress']);
      expect(help.modbus_params[name][`mb${id}NumRegisters`]).toEqual(['@helpModbusRegisterCount']);
      expect(help.modbus_params[name][`mb${id}DataToWrite`]).toEqual(['@helpModbusWriteData']);
    }
  });

  it('keeps Modbus Field probe power-up in milliseconds, independently of minute-based reporting', () => {
    const field = modbusField.modbus_params.b0_activation.fields.b0activation;
    expect(field.type).toBe('hex2B');
    expect(field.HMI.unit).toBe('ms');
    expect(field.default_value).toBe('2500');
    expect(field.max_value).toBe('65000');
  });

  it('explains the VentilO shared period without attaching fixed sampling settings to it', () => {
    const help = buildConfigurationFieldHelp(ventilo);
    expect(help.batch_params.global_params.gBatchEmission).toEqual(['@helpPressureBatchPeriod']);
    expect(ventilo.general_params.cfg_block.some(([, description]) => description === 'dfde')).toBe(false);
    for (const [template] of ventilo.batch_params.cfg_block) {
      expect(template.match(/\(gBatchEmission\)/g)).toHaveLength(2);
    }
  });
});
