import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('firmware update diagnostics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('writes firmware events to the persistent diagnostic scope', async () => {
    const diagnostics = await import('@/utils/BLE/firmwareUpdateDiagnostics');
    const logger = await import('@/utils/diagnosticLogger');

    diagnostics.writeFirmwareDiagnosticLine('[FW update] PREPARE: 09 07 C9 01');
    diagnostics.writeFirmwareDiagnosticLine('[FW update] Page 0x08007000 rejected; retry 1/3');
    diagnostics.writeFirmwareDiagnosticLine('[FW update] FAIL: Timed out waiting for indication');

    expect(logger.getDiagnosticLogs()).toEqual([
      expect.objectContaining({
        scope: 'firmware-update',
        level: 'info',
        message: '[FW update] PREPARE: 09 07 C9 01',
      }),
      expect.objectContaining({ scope: 'firmware-update', level: 'warn' }),
      expect.objectContaining({ scope: 'firmware-update', level: 'error' }),
    ]);
  });

  it('keeps page indications as detailed debug records', async () => {
    const diagnostics = await import('@/utils/BLE/firmwareUpdateDiagnostics');
    expect(diagnostics.firmwareDiagnosticLevel('[FW update] Indication: 03 00 70 00 08'))
      .toBe('debug');
    expect(diagnostics.firmwareDiagnosticLevel('[FW dry-run] PASS: application.hex'))
      .toBe('info');
  });
});
