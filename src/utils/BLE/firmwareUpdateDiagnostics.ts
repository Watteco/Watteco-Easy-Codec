import {
  writeDiagnosticLog,
  type DiagnosticLogLevel,
} from '@/utils/diagnosticLogger';

export const FIRMWARE_UPDATE_DIAGNOSTIC_SCOPE = 'firmware-update';

const ERROR_PATTERN = /(?:\bFAIL\b|failure\s+0x|failed after|mismatch|timed out|invalid erase|Flash .* failed)/i;
const WARNING_PATTERN = /(?:\bretry(?:ing)?\b|rejected|not accepted|unavailable|no FINISH confirmation)/i;

export function firmwareDiagnosticLevel(line: string): DiagnosticLogLevel {
  if (ERROR_PATTERN.test(line)) return 'error';
  if (WARNING_PATTERN.test(line)) return 'warn';
  if (/\b(?:Indication|Data:)\b/i.test(line)) return 'debug';
  return 'info';
}

export function writeFirmwareDiagnosticLine(line: string): void {
  writeDiagnosticLog(
    firmwareDiagnosticLevel(line),
    FIRMWARE_UPDATE_DIAGNOSTIC_SCOPE,
    line,
  );
}
