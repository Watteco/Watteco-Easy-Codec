import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'android'),
  isNativePlatform: vi.fn(() => true),
  requestPermissions: vi.fn(),
  writeFile: vi.fn(),
  getUri: vi.fn(),
  share: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: mocks.getPlatform,
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    requestPermissions: mocks.requestPermissions,
    writeFile: mocks.writeFile,
    getUri: mocks.getUri,
  },
}));

vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
vi.mock('@/utils/diagnosticLogger', () => ({
  getDiagnosticLogs: () => [],
  sanitizeDiagnosticValue: (value: unknown) => value,
}));

import {
  DIAGNOSTIC_REPORT_DIRECTORY, saveDiagnosticReport, shareDiagnosticReport,
} from '@/utils/diagnosticExport';

describe('diagnostic export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatform.mockReturnValue('android');
    mocks.requestPermissions.mockResolvedValue({ publicStorage: 'granted' });
    mocks.getUri.mockResolvedValue({ uri: 'content://diagnostic/report.txt' });
  });

  it('saves a text report in the user Documents directory', async () => {
    const filename = await saveDiagnosticReport({ connected: true });

    expect(filename).toMatch(/^wtc-neo-diagnostic-.+\.txt$/);
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      path: `${DIAGNOSTIC_REPORT_DIRECTORY}/${filename}`,
      directory: 'DOCUMENTS',
      encoding: 'utf8',
      recursive: true,
    }));
    const writtenReport = JSON.parse(mocks.writeFile.mock.calls[0][0].data);
    expect(writtenReport.context).toEqual({ connected: true });
  });

  it('shares the persistent Documents file instead of deleting a cache file', async () => {
    const filename = await shareDiagnosticReport();
    const path = `${DIAGNOSTIC_REPORT_DIRECTORY}/${filename}`;

    expect(mocks.getUri).toHaveBeenCalledWith({ path, directory: 'DOCUMENTS' });
    expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({
      files: ['content://diagnostic/report.txt'],
    }));
  });

  it('does not write when Android document access is denied', async () => {
    mocks.requestPermissions.mockResolvedValue({ publicStorage: 'denied' });

    await expect(saveDiagnosticReport()).rejects.toThrow('storage permission denied');
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
});
