export const SAVED_CONFIGURATION_FORMAT = 'watteco-easy-codec-configuration' as const;
export const SAVED_CONFIGURATION_SCHEMA_VERSION = 1 as const;
export const SAVED_CONFIGURATIONS_STORAGE_KEY = 'easycodec.savedConfigurations.v1';

export const CONFIGURATION_SECTION_NAMES = [
  'general_params',
  'batch_params',
  'modbus_params',
  'standard_params',
  'configuration_params',
  'commande_params',
] as const;

export type ConfigurationSectionName = typeof CONFIGURATION_SECTION_NAMES[number];

export interface SavedConfigurationField {
  value: string;
}

export interface SavedConfigurationGroup {
  enabled: boolean;
  fields: Record<string, SavedConfigurationField>;
}

export interface SavedConfigurationSection {
  enabled: boolean;
  groups: Record<string, SavedConfigurationGroup>;
}

export interface SavedConfiguration {
  format: typeof SAVED_CONFIGURATION_FORMAT;
  schemaVersion: typeof SAVED_CONFIGURATION_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  appVersion?: string;
  product: {
    configurationFile: string;
    reference?: string;
    displayName?: string;
  };
  sections: Partial<Record<ConfigurationSectionName, SavedConfigurationSection>>;
}

export interface ConfigurationDefinitionField {
  type?: string;
  default_value?: unknown;
  selectedValue?: unknown;
  min_value?: unknown;
  max_value?: unknown;
  choices?: unknown[];
  HMI?: unknown;
}

export interface ConfigurationDefinitionGroup {
  mandatory?: boolean | string;
  fields?: Record<string, ConfigurationDefinitionField>;
}

export type ConfigurationDefinition = Partial<Record<
  ConfigurationSectionName,
  Record<string, ConfigurationDefinitionGroup | unknown>
>>;

export interface ConfigurationLoadReport {
  addedFields: string[];
  removedFields: string[];
  resetInvalidFields: string[];
  addedGroups: string[];
  removedGroups: string[];
}

export interface ReconciledConfiguration {
  sections: Partial<Record<ConfigurationSectionName, {
    enabled: boolean;
    groups: Record<string, {
      enabled: boolean;
      values: Record<string, string>;
    }>;
  }>>;
  report: ConfigurationLoadReport;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isTrueFlag = (value: unknown): boolean => value === true || value === 'true';

const isSavedConfiguration = (value: unknown): value is SavedConfiguration => {
  if (!isRecord(value)) return false;
  if (
    value.format !== SAVED_CONFIGURATION_FORMAT
    || value.schemaVersion !== SAVED_CONFIGURATION_SCHEMA_VERSION
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.createdAt !== 'string'
    || typeof value.updatedAt !== 'string'
    || !isRecord(value.product)
    || typeof value.product.configurationFile !== 'string'
    || !isRecord(value.sections)
  ) {
    return false;
  }
  return Object.values(value.sections).every(section => {
    if (!isRecord(section) || typeof section.enabled !== 'boolean' || !isRecord(section.groups)) {
      return false;
    }
    return Object.values(section.groups).every(group => {
      if (!isRecord(group) || typeof group.enabled !== 'boolean' || !isRecord(group.fields)) {
        return false;
      }
      return Object.values(group.fields).every(field => (
        isRecord(field) && typeof field.value === 'string'
      ));
    });
  });
};

export const parseSavedConfiguration = (serialized: string): SavedConfiguration | null => {
  try {
    const parsed: unknown = JSON.parse(serialized);
    return isSavedConfiguration(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const readSavedConfigurations = (
  storage: StorageLike = localStorage,
): SavedConfiguration[] => {
  try {
    const raw = storage.getItem(SAVED_CONFIGURATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedConfiguration)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
};

export const writeSavedConfiguration = (
  configuration: SavedConfiguration,
  storage: StorageLike = localStorage,
): SavedConfiguration[] => {
  const configurations = readSavedConfigurations(storage);
  const existingIndex = configurations.findIndex(candidate => candidate.id === configuration.id);
  if (existingIndex >= 0) configurations[existingIndex] = configuration;
  else configurations.push(configuration);
  configurations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  storage.setItem(SAVED_CONFIGURATIONS_STORAGE_KEY, JSON.stringify(configurations));
  return configurations;
};

export const deleteSavedConfiguration = (
  configurationId: string,
  storage: StorageLike = localStorage,
): SavedConfiguration[] => {
  const configurations = readSavedConfigurations(storage)
    .filter(configuration => configuration.id !== configurationId);
  storage.setItem(SAVED_CONFIGURATIONS_STORAGE_KEY, JSON.stringify(configurations));
  return configurations;
};

export const createConfigurationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const captureConfigurationSections = (
  definition: ConfigurationDefinition,
  sectionEnabled: Partial<Record<ConfigurationSectionName, boolean>>,
  groupEnabled: Readonly<Record<string, boolean>>,
): SavedConfiguration['sections'] => {
  const sections: SavedConfiguration['sections'] = {};

  CONFIGURATION_SECTION_NAMES.forEach(sectionName => {
    const definitionSection = definition[sectionName];
    if (!isRecord(definitionSection)) return;

    const groups: Record<string, SavedConfigurationGroup> = {};
    Object.entries(definitionSection).forEach(([groupName, rawGroup]) => {
      if (!isRecord(rawGroup) || !isRecord(rawGroup.fields)) return;

      const fields: Record<string, SavedConfigurationField> = {};
      Object.entries(rawGroup.fields).forEach(([fieldName, rawField]) => {
        if (!isRecord(rawField) || rawField.type === 'frame') return;
        const value = rawField.selectedValue ?? rawField.default_value;
        if (value !== undefined && value !== null) {
          fields[fieldName] = { value: String(value) };
        }
      });

      groups[groupName] = {
        enabled: isTrueFlag(rawGroup.mandatory) || Boolean(groupEnabled[groupName]),
        fields,
      };
    });

    sections[sectionName] = {
      enabled: Boolean(sectionEnabled[sectionName]),
      groups,
    };
  });

  return sections;
};

const choiceValue = (choice: unknown): string => (
  Array.isArray(choice) ? String(choice[0]) : String(choice)
);

export const isSavedFieldValueValid = (
  value: string,
  field: ConfigurationDefinitionField,
): boolean => {
  if (field.type === 'bool' && value !== 'true' && value !== 'false') return false;

  if (Array.isArray(field.choices) && field.choices.length > 0) {
    if (!field.choices.some(choice => choiceValue(choice) === value)) return false;
  }

  const numericType = field.type === 'timeVal'
    || field.type === 'float'
    || (typeof field.type === 'string' && field.type.startsWith('hex'));
  if (!numericType) return true;

  const numbers = value.trim().split(/\s+/).map(Number);
  if (numbers.length === 0 || numbers.some(number => !Number.isFinite(number))) return false;
  const min = field.min_value === undefined ? undefined : Number(field.min_value);
  const max = field.max_value === undefined ? undefined : Number(field.max_value);
  if (min !== undefined && Number.isFinite(min) && numbers.some(number => number < min)) return false;
  if (max !== undefined && Number.isFinite(max) && numbers.some(number => number > max)) return false;
  return true;
};

const defaultFieldValue = (field: ConfigurationDefinitionField): string | undefined => {
  const value = field.default_value ?? field.selectedValue;
  return value === undefined || value === null ? undefined : String(value);
};

export const reconcileSavedConfiguration = (
  saved: SavedConfiguration,
  definition: ConfigurationDefinition,
): ReconciledConfiguration => {
  const report: ConfigurationLoadReport = {
    addedFields: [],
    removedFields: [],
    resetInvalidFields: [],
    addedGroups: [],
    removedGroups: [],
  };
  const sections: ReconciledConfiguration['sections'] = {};

  CONFIGURATION_SECTION_NAMES.forEach(sectionName => {
    const definitionSection = definition[sectionName];
    const savedSection = saved.sections[sectionName];
    if (!isRecord(definitionSection)) {
      Object.keys(savedSection?.groups ?? {}).forEach(groupName => {
        report.removedGroups.push(`${sectionName}.${groupName}`);
      });
      return;
    }
    const groups: Record<string, { enabled: boolean; values: Record<string, string> }> = {};

    Object.entries(definitionSection).forEach(([groupName, rawGroup]) => {
      if (!isRecord(rawGroup) || !isRecord(rawGroup.fields)) return;
      const group = rawGroup as ConfigurationDefinitionGroup;
      const savedGroup = savedSection?.groups[groupName];
      if (!savedGroup) report.addedGroups.push(`${sectionName}.${groupName}`);
      const values: Record<string, string> = {};

      Object.entries(group.fields ?? {}).forEach(([fieldName, field]) => {
        if (field.type === 'frame') return;
        const savedField = savedGroup?.fields[fieldName];
        const fallback = defaultFieldValue(field);
        if (!savedField) {
          if (savedGroup) report.addedFields.push(`${sectionName}.${groupName}.${fieldName}`);
          if (fallback !== undefined) values[fieldName] = fallback;
        } else if (isSavedFieldValueValid(savedField.value, field)) {
          values[fieldName] = savedField.value;
        } else {
          report.resetInvalidFields.push(`${sectionName}.${groupName}.${fieldName}`);
          if (fallback !== undefined) values[fieldName] = fallback;
        }
      });

      Object.keys(savedGroup?.fields ?? {}).forEach(fieldName => {
        if (!group.fields?.[fieldName]) {
          report.removedFields.push(`${sectionName}.${groupName}.${fieldName}`);
        }
      });

      groups[groupName] = {
        enabled: isTrueFlag(group.mandatory) || Boolean(savedGroup?.enabled),
        values,
      };
    });

    Object.keys(savedSection?.groups ?? {}).forEach(groupName => {
      const definitionGroup = definitionSection[groupName];
      if (!isRecord(definitionGroup) || !isRecord(definitionGroup.fields)) {
        report.removedGroups.push(`${sectionName}.${groupName}`);
      }
    });

    sections[sectionName] = {
      enabled: Boolean(savedSection?.enabled)
        || Object.entries(groups).some(([groupName, group]) => (
          group.enabled && isTrueFlag((definitionSection[groupName] as ConfigurationDefinitionGroup)?.mandatory)
        )),
      groups,
    };
  });

  return { sections, report };
};

export const configurationLoadReportCount = (report: ConfigurationLoadReport): number => (
  report.addedFields.length
  + report.removedFields.length
  + report.resetInvalidFields.length
  + report.addedGroups.length
  + report.removedGroups.length
);
