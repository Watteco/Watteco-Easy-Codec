import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { appVersion } from '@/utils/appVersion';
import { getDiagnosticLogs, sanitizeDiagnosticValue } from '@/utils/diagnosticLogger';

export const DIAGNOSTIC_REPORT_FORMAT = 'watteco-easy-codec-diagnostic';
export const DIAGNOSTIC_REPORT_SCHEMA_VERSION = 1;
export const DIAGNOSTIC_REPORT_DIRECTORY = 'Easy Codec/Diagnostics';

function diagnosticFilename(date = new Date()): string {
  return `wtc-neo-diagnostic-${date.toISOString().replace(/[:.]/g, '-')}.txt`;
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

async function requestDocumentStoragePermission(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const permission = await Filesystem.requestPermissions();
  if (permission.publicStorage !== 'granted') {
    throw new Error('Diagnostic document storage permission denied');
  }
}

async function writeDiagnosticReport(
  context: Record<string, unknown>,
): Promise<{ filename: string; path: string }> {
  await requestDocumentStoragePermission();

  const filename = diagnosticFilename();
  const path = `${DIAGNOSTIC_REPORT_DIRECTORY}/${filename}`;
  await Filesystem.writeFile({
    path,
    data: JSON.stringify(buildDiagnosticReport(context), null, 2),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  return { filename, path };
}

export async function saveDiagnosticReport(
  context: Record<string, unknown> = {},
): Promise<string> {
  const { filename } = await writeDiagnosticReport(context);
  return filename;
}

export async function shareDiagnosticReport(
  context: Record<string, unknown> = {},
): Promise<string> {
  const { filename, path } = await writeDiagnosticReport(context);
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });
  await Share.share({
    title: 'Watteco Neo diagnostic',
    text: 'Watteco Neo diagnostic report',
    files: [uri],
    dialogTitle: 'Share diagnostic report',
  });
  return filename;
}

export async function exportDiagnosticReport(context: Record<string, unknown> = {}): Promise<string> {
  const filename = diagnosticFilename();
  const serialized = JSON.stringify(buildDiagnosticReport(context), null, 2);

  if (!Capacitor.isNativePlatform()) {
    downloadFile(serialized, filename);
    return filename;
  }

  return shareDiagnosticReport(context);
}
