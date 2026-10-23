import { describe, expect, it } from 'vitest';
import pt1000Config from '../../../public/config/50-70-307-Temp\'O-Neo-PT1000.json';
import hygroTempConfig from '../../../public/config/50-70-260-671-HygroTemp\'O-Neo.json';
import pulseConfig from '../../../public/config/50-70-260-Pulse-Sens\'O-Neo.json';
import pulseLiteConfig from '../../../public/config/50-70-304-Pulse-Sens\'O-Lite-Neo.json';
import { parseReportingConfigurations } from '@/utils/BLE/reportingConfiguration';

function frame(value: string): Uint8Array {
  return Uint8Array.from(
    value.match(/[0-9a-f]{2}/gi)?.map(byte => Number.parseInt(byte, 16)) ?? [],
  );
}

describe('reporting configuration parsing', () => {
  it('loads every editable PT1000 Neo reporting value', () => {
    const result = parseReportingConfigurations(pt1000Config, [
      frame('11 09 0050 00 80 0006 41 800A 85A0 0E 70 04 0B54 0000 01 71 04 0CE4 0000 01'),
      frame('11 09 0402 00 80 0000 29 800A 803C 70 05DC 0000 01 71 0BB8 0000 01'),
      frame('31 09 0402 00 80 0000 29 800A 803C 70 05DC 0000 01 71 0BB8 0000 01'),
      frame('11 09 0402 00 15 0000 00 800A 803C 0000 000A 03'),
      frame('31 09 0402 00 15 0000 00 800A 803C 0000 000A 0B'),
      frame('11 09 0050 00 15 0006 04 85A0 85A0 0000 0064 33'),
    ]);

    expect(result.matchedFrameCount).toBe(6);
    expect(result.unmatchedFrames).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.fieldValues).toMatchObject({
      tBatchEchant: '10',
      gBatchEmission: '60',
      bBatchEchant: '1440',
      tStandEchant: '10',
      tStandEmission: '60',
      tNotification: '15 30',
      t2StandEchant: '10',
      t2StandEmission: '60',
      t2Notification: '15 30',
      bStandEchant: '10',
      bStandEmission: '1440',
      bNotification: '2900 3300',
    });
  });

  it('detects an unknown reporting frame and a conflicting shared value', () => {
    const result = parseReportingConfigurations(pt1000Config, [
      frame('11 09 0402 00 15 0000 00 800A 803C 0000 000A 03'),
      frame('31 09 0402 00 15 0000 00 800A 8030 0000 000A 0B'),
      frame('11 09 1234 00 80 0000 20 8001 8002'),
    ]);

    expect(result.unmatchedFrames).toHaveLength(1);
    expect(result.unmatchedFrameDetails).toEqual([{
      hex: '11 09 12 34 00 80 00 00 20 80 01 80 02',
      reason: 'length-mismatch',
      normalizedLength: 12,
      expectedLengths: expect.any(Array),
    }]);
    expect(result.conflicts).toEqual([{
      fieldName: 'gBatchEmission',
      values: ['60', '48'],
    }]);
    expect(result.fieldValues.gBatchEmission).toBeUndefined();
  });

  it('parses HygroTemp shared batch values and scaled humidity thresholds', () => {
    const result = parseReportingConfigurations(hygroTempConfig, [
      frame('53 09 0402 00 15 0000 00 803C 80F0 0000 000A 24'),
      frame('53 09 0405 00 15 0000 00 803C 80F0 0000 0064 2C'),
      frame('53 09 0405 00 80 0000 29 800A 803C 70 09C4 0000 01 71 1D4C 0000 01'),
    ]);

    expect(result.unmatchedFrames).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.fieldValues).toMatchObject({
      thBatchEchant: '60',
      gBatchEmission: '240',
      hStandEchant: '10',
      hStandEmission: '60',
      hNotification: '25 75',
    });
  });

  it('parses the Pulse Neo pattern reporting mode in the shared multi-state group', () => {
    const result = parseReportingConfigurations(pulseConfig, [
      frame('11 09 8005 00 88 0000 19 800A 85A0 F1 0001 0002 80 0003 0004'),
    ]);

    expect(result.exclusiveGroupConflicts).toEqual([]);
    expect(result.matchedGroups).toContainEqual({
      sectionName: 'standard_params',
      groupName: 'standard_PMultiState_params',
    });
    expect(result.fieldValues.pMultiStateStandEchant).toBe('10');
    expect(result.fieldValues.pMultiStateStandEmission).toBe('1440');
    expect(result.fieldValues.pMultiStatePattern).toBe('1 2');
    expect(result.fieldValues.pMultiStatePatternOccurrences).toBe('3 4');
  });

  it('parses Pulse Lite batch and multi-state reporting frames', () => {
    const result = parseReportingConfigurations(pulseLiteConfig, [
      frame('11 09 000F 00 1D 0402 00 803C 80F0 00000000 00000001 04'),
      frame('11 09 8005 00 00 0000 19 800A 85A0 0001'),
    ]);

    expect(result.unmatchedFrames).toEqual([]);
    expect(result.fieldValues).toMatchObject({
      pBatchEchant: '60',
      gBatchEmission: '240',
      pMultiStateStandEchant: '10',
      pMultiStateStandEmission: '1440',
      pMultiStateNotification: 'true',
    });
  });

  it('does not silently choose between duplicated placeholders', () => {
    const result = parseReportingConfigurations(pulseLiteConfig, [
      frame('11 09 000F 00 00 0402 23 800A 85A0 00000000'),
    ]);

    expect(result.conflicts).toEqual([{
      fieldName: 'p1StandEmission',
      values: ['10', '1440'],
    }]);
    expect(result.fieldValues.p1StandEmission).toBeUndefined();
  });

  it('flags seconds when the field has not opted in', () => {
    const result = parseReportingConfigurations(pt1000Config, [
      frame('11 09 0402 00 15 0000 00 000A 803C 0000 000A 03'),
    ]);

    expect(result.matchedFrameCount).toBe(1);
    expect(result.fieldValues.tBatchEchant).toBeUndefined();
    expect(result.unsupportedValues).toEqual([{
      fieldName: 'tBatchEchant',
      rawHex: '000A',
      reason: 'seconds-not-representable',
      frameHex: '11 09 04 02 00 15 00 00 00 00 0A 80 3C 00 00 00 0A 03',
    }]);
  });

  it('preserves seconds when the field explicitly opts in', () => {
    const config = structuredClone(pt1000Config) as any;
    config.batch_params.batch_T_params.fields.tBatchEchant.HMI.allow_seconds = true;
    const result = parseReportingConfigurations(config, [
      frame('11 09 0402 00 15 0000 00 000A 803C 0000 000A 03'),
    ]);

    expect(result.fieldValues.tBatchEchant).toBe('10s');
    expect(result.unsupportedValues).toEqual([]);
  });
});
