import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('diagnosticLogger', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('keeps diagnostic frames while redacting actual secrets', async () => {
    const logger = await import('./diagnosticLogger');

    logger.writeDiagnosticLog('error', 'ble', 'Frame rejected', {
      frameHex: '11 09 04 02 00 15',
      devEui: '0018B20000001234',
      otaAppKeyHex: '2B7E151628AED2A6ABF7158809CF4F3C',
      nested: { token: 'private-token' },
    });

    const [entry] = logger.getDiagnosticLogs();
    expect(entry.context).toEqual({
      frameHex: '11 09 04 02 00 15',
      devEui: '0018B20000001234',
      otaAppKeyHex: '[REDACTED]',
      nested: { token: '[REDACTED]' },
    });
  });

  it('persists errors and restores them after a new module load', async () => {
    const firstLogger = await import('./diagnosticLogger');
    firstLogger.writeDiagnosticLog('warn', 'ble', 'Connection failed', { code: 133 });

    vi.resetModules();
    const restoredLogger = await import('./diagnosticLogger');

    expect(restoredLogger.getDiagnosticLogs()).toEqual([
      expect.objectContaining({
        level: 'warn',
        scope: 'ble',
        message: 'Connection failed',
        context: { code: 133 },
      }),
    ]);
  });

  it('sanitizes exported context without hiding protocol frames', async () => {
    const logger = await import('./diagnosticLogger');

    expect(logger.sanitizeDiagnosticValue({
      frameHex: '01020304',
      apiKey: 'private',
    })).toEqual({
      frameHex: '01020304',
      apiKey: '[REDACTED]',
    });
  });

  it('extracts useful messages from native console error objects', async () => {
    const logger = await import('./diagnosticLogger');

    expect(logger.formatDiagnosticConsoleMessage([{ message: 'Read timeout.' }]))
      .toBe('Read timeout.');
    expect(logger.formatDiagnosticConsoleMessage([new Error('Disconnected')]))
      .toBe('Error: Disconnected');
  });

  it('keeps only the most recent entries', async () => {
    const logger = await import('./diagnosticLogger');
    for (let index = 0; index <= logger.MAX_DIAGNOSTIC_LOG_ENTRIES; index += 1) {
      logger.writeDiagnosticLog('debug', 'test', `entry-${index}`);
    }

    const logs = logger.getDiagnosticLogs();
    expect(logs).toHaveLength(logger.MAX_DIAGNOSTIC_LOG_ENTRIES);
    expect(logs[0].message).toBe('entry-1');
  });
});
