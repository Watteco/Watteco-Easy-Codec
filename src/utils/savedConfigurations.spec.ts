import { beforeEach, describe, expect, it } from 'vitest';
import {
  SAVED_CONFIGURATIONS_STORAGE_KEY,
  captureConfigurationSections,
  configurationLoadReportCount,
  deleteSavedConfiguration,
  parseSavedConfiguration,
  readSavedConfigurations,
  reconcileSavedConfiguration,
  writeSavedConfiguration,
  type ConfigurationDefinition,
  type SavedConfiguration,
} from '@/utils/savedConfigurations';
import pulseSensoLiteNeoConfig from '../../public/config/50-70-304-Pulse-Sens\'O-Lite-Neo.json';

const definition: ConfigurationDefinition = {
  general_params: {
    confirmed: {
      fields: {
        confirmed: { type: 'bool', default_value: 'false', selectedValue: 'true' },
      },
    },
  },
  batch_params: {
    batch_P_params: {
      fields: {
        pBatchEchant: {
          type: 'timeVal',
          default_value: '60',
          selectedValue: '30',
          min_value: '1',
          max_value: '120',
        },
      },
    },
  },
};

const savedConfiguration = (overrides: Partial<SavedConfiguration> = {}): SavedConfiguration => ({
  format: 'watteco-easy-codec-configuration',
  schemaVersion: 1,
  id: 'saved-1',
  name: 'Main meter',
  createdAt: '2026-10-19T09:30:00.000Z',
  updatedAt: '2026-10-19T10:15:00.000Z',
  product: {
    configurationFile: "50-70-304-Pulse-Sens'O-Lite-Neo",
    reference: '50-70-304',
  },
  sections: captureConfigurationSections(
    definition,
    { general_params: true, batch_params: true },
    { confirmed: true, batch_P_params: true },
  ),
  ...overrides,
});

describe('savedConfigurations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('captures values and activation state without copying the product definition', () => {
    const sections = captureConfigurationSections(
      definition,
      { general_params: true, batch_params: false },
      { confirmed: true, batch_P_params: false },
    );

    expect(sections.general_params).toEqual({
      enabled: true,
      groups: {
        confirmed: {
          enabled: true,
          fields: { confirmed: { value: 'true' } },
        },
      },
    });
    expect(sections.batch_params?.groups.batch_P_params).toEqual({
      enabled: false,
      fields: { pBatchEchant: { value: '30' } },
    });
  });

  it('writes, updates, sorts and deletes named configurations', () => {
    writeSavedConfiguration(savedConfiguration());
    writeSavedConfiguration(savedConfiguration({
      id: 'saved-2',
      name: 'Secondary meter',
      updatedAt: '2026-10-20T10:15:00.000Z',
    }));
    writeSavedConfiguration(savedConfiguration({ name: 'Renamed meter' }));

    expect(readSavedConfigurations().map(configuration => configuration.name))
      .toEqual(['Secondary meter', 'Renamed meter']);

    deleteSavedConfiguration('saved-2');
    expect(readSavedConfigurations().map(configuration => configuration.id)).toEqual(['saved-1']);
  });

  it('ignores invalid local storage content', () => {
    localStorage.setItem(SAVED_CONFIGURATIONS_STORAGE_KEY, '{invalid');
    expect(readSavedConfigurations()).toEqual([]);

    localStorage.setItem(SAVED_CONFIGURATIONS_STORAGE_KEY, JSON.stringify([{ schemaVersion: 99 }]));
    expect(readSavedConfigurations()).toEqual([]);
  });

  it('parses an exported configuration and rejects invalid files', () => {
    const configuration = savedConfiguration();

    expect(parseSavedConfiguration(JSON.stringify(configuration))).toEqual(configuration);
    expect(parseSavedConfiguration('{invalid')).toBeNull();
    expect(parseSavedConfiguration(JSON.stringify({ ...configuration, schemaVersion: 2 }))).toBeNull();
  });

  it('restores known values and reports definition changes', () => {
    const saved = savedConfiguration();
    saved.sections.batch_params!.groups.batch_P_params.fields.removedField = { value: '12' };
    saved.sections.batch_params!.groups.removedGroup = { enabled: true, fields: {} };

    const changedDefinition: ConfigurationDefinition = {
      ...definition,
      batch_params: {
        batch_P_params: {
          fields: {
            pBatchEchant: {
              type: 'timeVal',
              default_value: '60',
              min_value: '1',
              max_value: '20',
            },
            newField: { type: 'bool', default_value: 'true' },
          },
        },
        newGroup: {
          fields: {
            newGroupField: { type: 'timeVal', default_value: '10' },
          },
        },
      },
    };

    const result = reconcileSavedConfiguration(saved, changedDefinition);

    expect(result.sections.batch_params?.groups.batch_P_params.values).toEqual({
      pBatchEchant: '60',
      newField: 'true',
    });
    expect(result.sections.batch_params?.groups.newGroup.enabled).toBe(false);
    expect(result.report.resetInvalidFields).toContain('batch_params.batch_P_params.pBatchEchant');
    expect(result.report.addedFields).toContain('batch_params.batch_P_params.newField');
    expect(result.report.addedGroups).toContain('batch_params.newGroup');
    expect(result.report.removedFields).toContain('batch_params.batch_P_params.removedField');
    expect(result.report.removedGroups).toContain('batch_params.removedGroup');
    expect(configurationLoadReportCount(result.report)).toBe(5);
  });

  it('keeps mandatory new groups enabled', () => {
    const changedDefinition: ConfigurationDefinition = {
      ...definition,
      standard_params: {
        requiredGroup: {
          mandatory: 'true',
          fields: {
            requiredField: { type: 'bool', default_value: 'false' },
          },
        },
      },
    };

    const result = reconcileSavedConfiguration(savedConfiguration(), changedDefinition);

    expect(result.sections.standard_params?.enabled).toBe(true);
    expect(result.sections.standard_params?.groups.requiredGroup.enabled).toBe(true);
  });

  it('round-trips the Pulse SensO Lite Neo definition without compatibility warnings', () => {
    const sections = captureConfigurationSections(
      pulseSensoLiteNeoConfig,
      { general_params: true, batch_params: true, standard_params: false },
      {
        remove_config: true,
        confirmed: true,
        batch_P_params: true,
        batch_B_params: true,
        global_params: true,
        standard_P1_params: false,
        standard_PMultiState_params: false,
        standard_B_params: false,
      },
    );
    const reconciled = reconcileSavedConfiguration(
      savedConfiguration({ sections }),
      pulseSensoLiteNeoConfig,
    );

    expect(configurationLoadReportCount(reconciled.report)).toBe(0);
    expect(reconciled.sections.batch_params?.groups.batch_P_params.values.pBatchEchant).toBe('60');
    expect(reconciled.sections.standard_params?.groups.standard_B_params.enabled).toBe(false);
  });
});
