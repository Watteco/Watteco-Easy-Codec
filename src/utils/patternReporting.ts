export type PatternReportingField = {
  type?: string;
  selectedValue?: unknown;
  HMI?: {
    visual_type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type PatternReportingGroup = {
  fields?: Record<string, PatternReportingField>;
  [key: string]: unknown;
};

export type PatternReportingSection = Record<string, unknown> & {
  cfg_block?: unknown[];
};

export type PatternReportingMode = 'variation' | 'periodic' | 'pattern';

export type PatternReportingContext = {
  groupName: string;
  patternFieldName: string;
  controlFieldName: string;
  occurrenceFieldNames: string[];
};

export function configurationFrameTemplate(entry: unknown): string | null {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
  return null;
}

function placeholderNames(frame: string): string[] {
  return Array.from(frame.matchAll(/\(([^)]+)\)/g), match => match[1]);
}

function resolveFieldName(
  placeholderName: string,
  fields: Record<string, PatternReportingField>,
): string | null {
  if (fields[placeholderName]) return placeholderName;
  const baseName = placeholderName.replace(/[12]$/, '');
  return fields[baseName] ? baseName : null;
}

export function referencedFieldNames(
  frame: string,
  fields: Record<string, PatternReportingField>,
): Set<string> {
  return new Set(
    placeholderNames(frame)
      .map(name => resolveFieldName(name, fields))
      .filter((name): name is string => name !== null),
  );
}

export function findPatternReportingContext(
  section: PatternReportingSection | undefined,
  groupName: string,
): PatternReportingContext | null {
  const group = section?.[groupName] as PatternReportingGroup | undefined;
  const fields = group?.fields;
  if (!fields || !Array.isArray(section?.cfg_block)) return null;

  const frames = section.cfg_block
    .map(configurationFrameTemplate)
    .filter((frame): frame is string => frame !== null);
  const referencedByFrame = frames.map(frame => ({
    frame,
    fields: referencedFieldNames(frame, fields),
  }));

  const patternFieldName = Object.keys(fields).find(fieldName => (
    fields[fieldName].HMI?.visual_type === 'pattern'
    && referencedByFrame.some(candidate => candidate.fields.has(fieldName))
  ));
  if (!patternFieldName) return null;

  const patternFrames = referencedByFrame.filter(candidate => (
    candidate.fields.has(patternFieldName)
  ));
  const controlFieldName = Object.keys(fields).find(fieldName => {
    const field = fields[fieldName];
    return field.type === 'bool'
      && field.HMI?.visual_type === 'checkbox'
      && referencedByFrame.some(candidate => (
        !candidate.fields.has(patternFieldName)
        && candidate.fields.has(fieldName)
      ));
  });
  if (!controlFieldName) return null;

  const occurrenceFieldNames = Object.keys(fields).filter(fieldName => (
    fields[fieldName].HMI?.visual_type === 'occurrences'
    && patternFrames.some(candidate => candidate.fields.has(fieldName))
  ));

  return {
    groupName,
    patternFieldName,
    controlFieldName,
    occurrenceFieldNames,
  };
}

function isEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function patternHasSelectedInputs(value: unknown): boolean {
  const [, gap = '0'] = String(value ?? '').trim().split(/\s+/);
  const parsedGap = Number.parseInt(gap, 10);
  return Number.isFinite(parsedGap) && parsedGap !== 0;
}

export function patternReportingMode(
  context: PatternReportingContext,
  fields: Record<string, PatternReportingField>,
): PatternReportingMode {
  if (isEnabled(fields[context.controlFieldName]?.selectedValue)) return 'variation';
  return patternHasSelectedInputs(fields[context.patternFieldName]?.selectedValue)
    ? 'pattern'
    : 'periodic';
}

export function patternReportingFrameRole(
  context: PatternReportingContext,
  frame: string,
  fields: Record<string, PatternReportingField>,
): 'standard' | 'pattern' | null {
  const referencedFields = referencedFieldNames(frame, fields);
  if (referencedFields.has(context.patternFieldName)) return 'pattern';
  if (referencedFields.has(context.controlFieldName)) return 'standard';
  return null;
}

export function shouldIncludePatternReportingFrame(
  context: PatternReportingContext,
  frame: string,
  fields: Record<string, PatternReportingField>,
): boolean {
  const role = patternReportingFrameRole(context, frame, fields);
  if (role === null) return true;
  const mode = patternReportingMode(context, fields);
  return role === 'pattern' ? mode === 'pattern' : mode !== 'pattern';
}

export function isPatternReportingFieldVisible(
  context: PatternReportingContext,
  fieldName: string,
  fields: Record<string, PatternReportingField>,
): boolean {
  const mode = patternReportingMode(context, fields);
  if (fieldName === context.patternFieldName) return mode !== 'variation';
  if (context.occurrenceFieldNames.includes(fieldName)) return mode === 'pattern';
  return true;
}
