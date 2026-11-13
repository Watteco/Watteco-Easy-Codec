import { describe, expect, it } from 'vitest';
import {
  buildCounterSetFrame,
  getCounterEndpoint,
  MAX_COUNTER_VALUE,
  parseCounterValue,
} from '@/utils/BLE/counterCommands';

describe('counter commands', () => {
  it.each([
    [0, 0, '1102000f04022300000000'],
    [1, 54321, '3102000f0402230000d431'],
    [2, MAX_COUNTER_VALUE, '5102000f040223ffffffff'],
    [7, 1, 'f102000f04022300000001'],
    [8, 1, '1302000f04022300000001'],
    [9, 1, '3302000f04022300000001'],
  ])('builds the endpoint %i frame', (endpoint, value, expected) => {
    const frameHex = Array.from(buildCounterSetFrame(endpoint, value)!)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    expect(frameHex).toBe(expected);
  });

  it('rejects invalid endpoints and values', () => {
    expect(buildCounterSetFrame(-1, 0)).toBeNull();
    expect(buildCounterSetFrame(10, 0)).toBeNull();
    expect(buildCounterSetFrame(0, -1)).toBeNull();
    expect(buildCounterSetFrame(0, MAX_COUNTER_VALUE + 1)).toBeNull();
    expect(buildCounterSetFrame(0, 1.5)).toBeNull();
  });

  it('maps displayed counter instances to zero-based endpoints', () => {
    expect(getCounterEndpoint('index')).toBe(0);
    expect(getCounterEndpoint('index_1')).toBe(0);
    expect(getCounterEndpoint('index_2')).toBe(1);
    expect(getCounterEndpoint('index_10')).toBe(9);
    expect(getCounterEndpoint('temperature')).toBeNull();
    expect(getCounterEndpoint('index_11')).toBeNull();
  });

  it('parses uint32 values entered in the counter dialog', () => {
    expect(parseCounterValue(' 54321 ')).toBe(54321);
    expect(parseCounterValue('4294967295')).toBe(MAX_COUNTER_VALUE);
    expect(parseCounterValue('')).toBeNull();
    expect(parseCounterValue('-1')).toBeNull();
    expect(parseCounterValue('1.5')).toBeNull();
    expect(parseCounterValue('4294967296')).toBeNull();
  });
});
