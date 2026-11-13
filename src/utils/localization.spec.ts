import { describe, expect, it } from 'vitest';
import { createBundledTranslations } from '@/utils/localization';

describe('createBundledTranslations', () => {
  it('provides both languages before a view is mounted', () => {
    const languages = createBundledTranslations();

    expect(languages.en.diagnosticReportSessions).toBe('Sessions included');
    expect(languages.fr.diagnosticReportSessions).toBe('Sessions incluses');
  });

  it('returns isolated maps for each view', () => {
    const first = createBundledTranslations();
    const second = createBundledTranslations();

    first.fr.diagnosticReportSessions = 'changed';

    expect(second.fr.diagnosticReportSessions).toBe('Sessions incluses');
  });
});
