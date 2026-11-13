import { referencedFieldNames, type PatternReportingField } from '@/utils/patternReporting';

type HelpField = PatternReportingField & { HMI?: { description?: unknown; [key: string]: unknown } };
type HelpGroup = { fields?: Record<string, HelpField> };
export type FieldHelpIndex = Record<string, Record<string, Record<string, string[]>>>;

// Resolve against all fields in a section so a real name ending in 1/2 takes
// precedence over a split-value placeholder (for example threshold1/threshold2).
export function buildConfigurationFieldHelp(config: Record<string, unknown>): FieldHelpIndex {
  const result: FieldHelpIndex = {};
  for (const [sectionName, candidate] of Object.entries(config)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const section = candidate as Record<string, unknown>;
    const groups = Object.entries(section).filter((entry): entry is [string, HelpGroup] => (
      !!entry[1] && typeof entry[1] === 'object' && 'fields' in entry[1]
    ));
    const fields = Object.assign({}, ...groups.map(([, group]) => group.fields)) as Record<string, HelpField>;
    const comments = new Map<string, Set<string>>();
    for (const entry of Array.isArray(section.cfg_block) ? section.cfg_block : []) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') continue;
      const description = entry[1].trim();
      if (!description) continue;
      for (const name of referencedFieldNames(entry[0], fields)) {
        if (!comments.has(name)) comments.set(name, new Set());
        comments.get(name)!.add(description);
      }
    }
    result[sectionName] = {};
    for (const [groupName, group] of groups) {
      result[sectionName][groupName] = {};
      for (const [fieldName, field] of Object.entries(group.fields ?? {})) {
        const explicit = field.HMI?.description;
        result[sectionName][groupName][fieldName] = typeof explicit === 'string'
          ? (explicit.trim() ? [explicit.trim()] : [])
          : [...(comments.get(fieldName) ?? [])];
      }
    }
  }
  return result;
}
