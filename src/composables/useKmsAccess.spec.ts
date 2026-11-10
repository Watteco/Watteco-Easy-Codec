import { beforeEach, describe, expect, it } from 'vitest';
import {
  KMS_ACCESS_ENFORCEMENT_ENABLED,
  useKmsAccess,
} from '@/composables/useKmsAccess';

describe('useKmsAccess', () => {
  const kmsAccess = useKmsAccess();

  beforeEach(() => {
    kmsAccess.clearPrivilegedDevEuis();
  });

  it('assumes access for every valid DevEUI until KMS enforcement is enabled', () => {
    expect(KMS_ACCESS_ENFORCEMENT_ENABLED).toBe(false);
    kmsAccess.setPrivilegedDevEuis(['70:b3:d5:e7:5f:00:67:99']);

    expect(kmsAccess.hasPrivilegedAccess('70B3D5E75F006799')).toBe(true);
    expect(kmsAccess.hasPrivilegedAccess('70:B3:D5:E7:5F:00:00:01')).toBe(true);
    expect(kmsAccess.hasPrivilegedAccess('invalid')).toBe(false);

    expect(kmsAccess.hasKmsPrivilege('70B3D5E75F006799')).toBe(true);
    expect(kmsAccess.hasKmsPrivilege('70:B3:D5:E7:5F:00:00:01')).toBe(false);
    expect(kmsAccess.hasKmsPrivilege('invalid')).toBe(false);
  });

  it('ignores invalid DevEUIs', () => {
    kmsAccess.setPrivilegedDevEuis(['invalid', '70:B3:D5:E7:5F:00:67:99']);

    expect([...kmsAccess.privilegedDevEuis.value]).toEqual(['70B3D5E75F006799']);
  });

  it('adds one privileged DevEUI without replacing the others', () => {
    kmsAccess.setPrivilegedDevEuis(['70:B3:D5:E7:5F:00:67:99']);

    expect(kmsAccess.addPrivilegedDevEui('70B3D5E75F000001')).toBe(true);
    expect(kmsAccess.addPrivilegedDevEui('invalid')).toBe(false);
    expect([...kmsAccess.privilegedDevEuis.value]).toEqual([
      '70B3D5E75F006799',
      '70B3D5E75F000001',
    ]);
  });
});
