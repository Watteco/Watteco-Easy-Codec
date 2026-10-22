export type ReportingConfigurationSectionName = 'batch_params' | 'standard_params';

type ParameterDefinition = {
  type?: string;
  inverted?: string;
  min_value?: string | number;
  max_value?: string | number;
  HMI?: Record<string, unknown> & { multiplier?: string | number };
  [property: string]: unknown;
};

type ParameterGroup = {
  fields?: Record<string, ParameterDefinition>;
};

type ConfigurationSection = Record<string, unknown> & {
  cfg_block?: Array<string | readonly string[]>;
  global_params?: ParameterGroup;
  group_relationships?: Array<{
    type?: string;
    groups?: string[];
  }>;
};

export type ReportingSensorConfiguration = Partial<Record<
  ReportingConfigurationSectionName,
  ConfigurationSection
>>;

export type ReportingConfigurationConflict = {
  fieldName: string;
  values: string[];
};

export type UnsupportedReportingConfigurationValue = {
  fieldName: string;
  rawHex: string;
  reason: 'seconds-not-representable' | 'out-of-range';
  frameHex: string;
};

export type UnmatchedReportingConfigurationFrame = {
  hex: string;
  reason: 'length-mismatch' | 'fixed-bytes-mismatch';
  normalizedLength: number;
  expectedLengths: number[];
};

export type ReportingConfigurationParseResult = {
  matchedFrameCount: number;
  matchedGroups: Array<{
    sectionName: ReportingConfigurationSectionName;
    groupName: string;
  }>;
  fieldValues: Record<string, string>;
  conflicts: ReportingConfigurationConflict[];
  exclusiveGroupConflicts: string[][];
  unmatchedFrames: string[];
  unmatchedFrameDetails: UnmatchedReportingConfigurationFrame[];
  invalidFrames: Array<{ hex: string; status?: number }>;
  unsupportedValues: UnsupportedReportingConfigurationValue[];
};

type FieldLocation = {
  sectionName: ReportingConfigurationSectionName;
  groupName: string;
  fieldName: string;
  definition: ParameterDefinition;
};

type TemplateToken =
  | { kind: 'fixed'; value: number }
  | { kind: 'placeholder'; name: string; location: FieldLocation; width: number };

type ReportingTemplate = {
  sectionName: ReportingConfigurationSectionName;
  groupName: string;
  tokens: TemplateToken[];
  byteLength: number;
};

const REPORTING_SECTIONS: ReportingConfigurationSectionName[] = [
  'batch_params',
  'standard_params',
];

function toHex(frame: Uint8Array): string {
  return Array.from(frame, byte => byte.toString(16).padStart(2, '0'))
    .join(' ')
    .toUpperCase();
}

function placeholderWidth(definition: ParameterDefinition): number | null {
  if (definition.type === 'timeVal') return 2;
  if (definition.type === 'bool') return 1;
  const hexBytes = definition.type?.match(/^hex(\d+)B$/i);
  return hexBytes ? Number.parseInt(hexBytes[1], 10) : null;
}

function readUnsigned(bytes: readonly number[]): number {
  return bytes.reduce((value, byte) => (value * 256) + byte, 0);
}

function buildFieldLocations(config: ReportingSensorConfiguration): Map<string, FieldLocation> {
  const locations = new Map<string, FieldLocation>();
  for (const sectionName of REPORTING_SECTIONS) {
    const section = config[sectionName];
    if (!section) continue;
    for (const [groupName, candidate] of Object.entries(section)) {
      const group = candidate as ParameterGroup;
      if (!group?.fields) continue;
      for (const [fieldName, definition] of Object.entries(group.fields)) {
        locations.set(fieldName, { sectionName, groupName, fieldName, definition });
      }
    }
  }
  return locations;
}

function resolvePlaceholder(
  placeholderName: string,
  fields: Map<string, FieldLocation>,
): FieldLocation | null {
  const exact = fields.get(placeholderName);
  if (exact) return exact;
  const baseName = placeholderName.replace(/[12]$/, '');
  return fields.get(baseName) ?? null;
}

function compileTemplate(
  frameTemplate: string,
  sectionName: ReportingConfigurationSectionName,
  fields: Map<string, FieldLocation>,
): ReportingTemplate | null {
  const compact = frameTemplate.replace(/\s+/g, '');
  const rawTokens = compact.match(/\([^)]+\)|[0-9a-fA-F]{2}/g);
  if (!rawTokens || rawTokens.join('') !== compact) return null;

  const tokens: TemplateToken[] = [];
  const editableGroups = new Set<string>();
  let byteLength = 0;
  for (const rawToken of rawTokens) {
    if (!rawToken.startsWith('(')) {
      tokens.push({ kind: 'fixed', value: Number.parseInt(rawToken, 16) });
      byteLength++;
      continue;
    }

    const name = rawToken.slice(1, -1);
    const location = resolvePlaceholder(name, fields);
    const width = location ? placeholderWidth(location.definition) : null;
    if (!location || width === null) return null;
    tokens.push({ kind: 'placeholder', name, location, width });
    byteLength += width;
    if (location.groupName !== 'global_params') editableGroups.add(location.groupName);
  }

  if (editableGroups.size !== 1) return null;
  return {
    sectionName,
    groupName: Array.from(editableGroups)[0],
    tokens,
    byteLength,
  };
}

function compileTemplates(config: ReportingSensorConfiguration): ReportingTemplate[] {
  const fields = buildFieldLocations(config);
  const templates: ReportingTemplate[] = [];
  for (const sectionName of REPORTING_SECTIONS) {
    const entries = config[sectionName]?.cfg_block;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const frameTemplate = Array.isArray(entry) ? entry[0] : entry;
      if (typeof frameTemplate !== 'string') continue;
      const template = compileTemplate(frameTemplate, sectionName, fields);
      if (template) templates.push(template);
    }
  }
  return templates;
}

function normalizeReadReportingResponse(frame: Uint8Array): Uint8Array | null {
  if (frame.length < 6 || frame[1] !== 0x09 || frame[4] !== 0x00) return null;
  return Uint8Array.from([
    frame[0],
    0x06,
    frame[2],
    frame[3],
    ...frame.slice(5),
  ]);
}

function templateMatches(template: ReportingTemplate, frame: Uint8Array): boolean {
  if (frame.length !== template.byteLength) return false;
  let offset = 0;
  for (const token of template.tokens) {
    if (token.kind === 'fixed') {
      if (frame[offset] !== token.value) return false;
      offset++;
    } else {
      offset += token.width;
    }
  }
  return true;
}

function decodePlaceholder(
  token: Extract<TemplateToken, { kind: 'placeholder' }>,
  bytes: number[],
): {
  value?: string;
  unsupported?: Omit<UnsupportedReportingConfigurationValue, 'frameHex'>;
} {
  const rawValue = readUnsigned(bytes);
  const rawHex = bytes.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  const definition = token.location.definition;
  if (definition.type === 'timeVal') {
    const value = (rawValue & 0x8000) !== 0
      ? rawValue & 0x7fff
      : rawValue % 60 === 0
        ? rawValue / 60
        : null;
    if (value === null) {
      return {
        unsupported: {
          fieldName: token.location.fieldName,
          rawHex,
          reason: 'seconds-not-representable',
        },
      };
    }
    const minimum = Number(definition.min_value ?? Number.NEGATIVE_INFINITY);
    const maximum = Number(definition.max_value ?? Number.POSITIVE_INFINITY);
    if (value < minimum || value > maximum) {
      return {
        unsupported: {
          fieldName: token.location.fieldName,
          rawHex,
          reason: 'out-of-range',
        },
      };
    }
    return { value: String(value) };
  }
  if (definition.type === 'bool') {
    const truthy = definition.inverted === 'true' ? rawValue === 0 : rawValue !== 0;
    return { value: String(truthy) };
  }
  const multiplier = Number(definition.HMI?.multiplier ?? 1);
  const value = rawValue / multiplier;
  const minimum = Number(definition.min_value ?? Number.NEGATIVE_INFINITY);
  const maximum = Number(definition.max_value ?? Number.POSITIVE_INFINITY);
  if (value < minimum || value > maximum) {
    return {
      unsupported: {
        fieldName: token.location.fieldName,
        rawHex,
        reason: 'out-of-range',
      },
    };
  }
  return { value: String(value) };
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

export function parseReportingConfigurations(
  config: ReportingSensorConfiguration,
  responseFrames: readonly Uint8Array[],
): ReportingConfigurationParseResult {
  const templates = compileTemplates(config);
  const matchedGroups = new Map<string, {
    sectionName: ReportingConfigurationSectionName;
    groupName: string;
  }>();
  const collectedValues = new Map<string, string[]>();
  const conflicts = new Map<string, Set<string>>();
  const unmatchedFrames: string[] = [];
  const unmatchedFrameDetails: UnmatchedReportingConfigurationFrame[] = [];
  const invalidFrames: Array<{ hex: string; status?: number }> = [];
  const unsupportedValues: UnsupportedReportingConfigurationValue[] = [];
  let matchedFrameCount = 0;

  for (const responseFrame of responseFrames) {
    if (responseFrame[1] !== 0x09) continue;
    const hex = toHex(responseFrame);
    if (responseFrame.length < 6 || responseFrame[4] !== 0x00) {
      invalidFrames.push({
        hex,
        ...(responseFrame.length > 4 ? { status: responseFrame[4] } : {}),
      });
      continue;
    }
    const normalized = normalizeReadReportingResponse(responseFrame);
    if (!normalized) continue;
    const template = templates.find(candidate => templateMatches(candidate, normalized));
    if (!template) {
      unmatchedFrames.push(hex);
      const expectedLengths = unique(templates.map(candidate => String(candidate.byteLength)))
        .map(length => Number.parseInt(length, 10))
        .sort((left, right) => left - right);
      unmatchedFrameDetails.push({
        hex,
        reason: templates.some(candidate => candidate.byteLength === normalized.length)
          ? 'fixed-bytes-mismatch'
          : 'length-mismatch',
        normalizedLength: normalized.length,
        expectedLengths,
      });
      continue;
    }

    matchedFrameCount++;
    matchedGroups.set(`${template.sectionName}:${template.groupName}`, {
      sectionName: template.sectionName,
      groupName: template.groupName,
    });

    let offset = 0;
    const frameValues = new Map<string, Map<string, string[]>>();
    for (const token of template.tokens) {
      if (token.kind === 'fixed') {
        offset++;
        continue;
      }
      const bytes = Array.from(normalized.slice(offset, offset + token.width));
      offset += token.width;
      const decoded = decodePlaceholder(token, bytes);
      if (decoded.unsupported) {
        unsupportedValues.push({ ...decoded.unsupported, frameHex: hex });
        continue;
      }
      if (decoded.value === undefined) continue;
      const byPlaceholder = frameValues.get(token.location.fieldName) ?? new Map<string, string[]>();
      const values = byPlaceholder.get(token.name) ?? [];
      values.push(decoded.value);
      byPlaceholder.set(token.name, values);
      frameValues.set(token.location.fieldName, byPlaceholder);
    }

    for (const [fieldName, byPlaceholder] of frameValues) {
      const orderedValues: string[] = [];
      for (const values of byPlaceholder.values()) {
        const distinctValues = unique(values);
        if (distinctValues.length > 1) {
          const fieldConflicts = conflicts.get(fieldName) ?? new Set<string>();
          distinctValues.forEach(value => fieldConflicts.add(value));
          conflicts.set(fieldName, fieldConflicts);
        }
        orderedValues.push(distinctValues[0]);
      }
      const value = orderedValues.join(' ');
      const values = collectedValues.get(fieldName) ?? [];
      values.push(value);
      collectedValues.set(fieldName, values);
    }
  }

  const fieldValues: Record<string, string> = {};
  for (const [fieldName, values] of collectedValues) {
    const distinctValues = unique(values);
    if (distinctValues.length === 1 && !conflicts.has(fieldName)) {
      fieldValues[fieldName] = distinctValues[0];
      continue;
    }
    const fieldConflicts = conflicts.get(fieldName) ?? new Set<string>();
    distinctValues.forEach(value => fieldConflicts.add(value));
    conflicts.set(fieldName, fieldConflicts);
  }

  const matchedGroupList = Array.from(matchedGroups.values());
  const exclusiveGroupConflicts: string[][] = [];
  for (const sectionName of REPORTING_SECTIONS) {
    const relationships = config[sectionName]?.group_relationships;
    if (!Array.isArray(relationships)) continue;
    for (const relationship of relationships) {
      if (relationship.type !== 'exclusive' || !Array.isArray(relationship.groups)) continue;
      const activeGroups = relationship.groups.filter(groupName => (
        matchedGroups.has(`${sectionName}:${groupName}`)
      ));
      if (activeGroups.length > 1) exclusiveGroupConflicts.push(activeGroups);
    }
  }

  return {
    matchedFrameCount,
    matchedGroups: matchedGroupList,
    fieldValues,
    conflicts: Array.from(conflicts, ([fieldName, values]) => ({
      fieldName,
      values: Array.from(values),
    })),
    exclusiveGroupConflicts,
    unmatchedFrames,
    unmatchedFrameDetails,
    invalidFrames,
    unsupportedValues,
  };
}
