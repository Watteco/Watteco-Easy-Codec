import { registerPlugin } from '@capacitor/core';

export type StoredOsaKey = {
  devEui: string;
  keyHex: string;
  expiresAt: number;
};

export type OsaKeyStoreResult = {
  success: boolean;
  devEui: string;
  expiresAt?: number;
  deleted?: boolean;
  purged?: number;
};

type OsaKeyStorePlugin = {
  store(options: StoredOsaKey): Promise<OsaKeyStoreResult>;
  get(options: { devEui: string }): Promise<StoredOsaKey>;
  delete(options: { devEui: string }): Promise<OsaKeyStoreResult>;
  purgeExpired(): Promise<OsaKeyStoreResult>;
};

export const OsaKeyStore = registerPlugin<OsaKeyStorePlugin>('OsaKeyStore');
