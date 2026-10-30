import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { appVersion } from '@/utils/appVersion';
import { getDiagnosticLogs, sanitizeDiagnosticValue } from '@/utils/diagnosticLogger';

export const DIAGNOSTIC_REPORT_FORMAT = 'watteco-easy-codec-diagnostic';
export const DIAGNOSTIC_REPORT_SCHEMA_VERSION = 1;

function diagnosticFilename(date = new Date()): string {
  return `easy-codec-diagnostic-${date.toISOString().replace(/[:.]/g, '-')}.txt`;
}

export function buildDiagnosticReport(context: Record<string, unknown> = {}) {
  return {
    format: DIAGNOSTIC_REPORT_FORMAT,
    schemaVersion: DIAGNOSTIC_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    application: {
      version: appVersion,
      platform: Capacitor.getPlatform(),
      native: Capacitor.isNativePlatform(),
      language: typeof navigator === 'undefined' ? undefined : navigator.language,
      userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
      url: typeof location === 'undefined' ? undefined : location.href,
    },
    context: sanitizeDiagnosticValue(context),
    logs: getDiagnosticLogs(),
  };
}

function downloadFile(serialized: string, filename: string) {
  const file = new File([serialized], filename, { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportDiagnosticReport(context: Record<string, unknown> = {}): Promise<string> {
  const filename = diagnosticFilename();
  const serialized = JSON.stringify(buildDiagnosticReport(context), null, 2);

  if (!Capacitor.isNativePlatform()) {
    downloadFile(serialized, filename);
    return filename;
  }

  let temporaryFileCreated = false;
  try {
    await Filesystem.writeFile({
      path: filename,
      data: serialized,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    temporaryFileCreated = true;
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({
      title: 'Easy Codec diagnostic',
      text: 'Easy Codec diagnostic report',
      files: [uri],
      dialogTitle: 'Share diagnostic report',
    });
    return filename;
  } finally {
    if (temporaryFileCreated) {
      try {
        await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
      } catch {
        // The cache directory is disposable; a cleanup failure is not user-facing.
      }
    }
  }
}
