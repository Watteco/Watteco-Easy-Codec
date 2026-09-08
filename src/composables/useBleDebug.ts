import { ref, watch, onUnmounted } from 'vue';
import {
  startDebugSubscriptions as startBleDebugSubscriptions,
  stopDebugSubscriptions as stopBleDebugSubscriptions,
  dumpServices as dumpBleServices,
  dumpServicesOnly as dumpBleServicesOnly,
} from '@/utils/BLE/connection';
import type { BleSubscriptionTarget } from '@/utils/BLE/connection';
import {
  parseHexToUint8Array,
  writeToCharacteristicByShort,
  writeToCharacteristicInService,
  writeToFf01 as writeFf01Blob,
  readCharacteristicByShort,
  readCharacteristicInServiceByShort,
  downloadConfigurationBlob,
} from '@/utils/BLE/blob';
import { runOsaChallenge, readOsaChallenge } from '@/utils/BLE/osa';
import { autoFetchModelFirmware as fetchModelFirmwareFromBle } from '@/utils/BLE/configReader';
import { OsaKeyStore } from '@/plugins/osaKeyStore';

type UseBleDebugOptions = {
  enabled: boolean;
};

export function useBleDebug(ble: any, options: UseBleDebugOptions) {
  const debugVisible = ref(false);
  const debugLogs = ref<string[]>([]);
  const debugSubscribed = ref(false);
  const lastMirroredBleEvent = ref<string>('');
  const debugSubscriptionTargets = ref<BleSubscriptionTarget[]>([]);

  const debugHex = ref('01');
  const debugOtaAppKeyHex = ref('2B7E151628AED2A6ABF7158809CF4F3C');
  const debugDevEuiHex = ref('70B3D5E75F006761');
  const modelInfo = ref<string | null>(null);
  const firmwareInfo = ref<string | null>(null);

  const pushDebugLog = (line: string) => {
    debugLogs.value.unshift(line);
    if (debugLogs.value.length > 200) debugLogs.value.pop();
  };

  async function startDebugSubscriptions() {
    if (!options.enabled) return;
    if (!ble.connected.value || !ble.connectedDevice.value) return;
    if (debugSubscribed.value) return;

    try {
      debugSubscriptionTargets.value = await startBleDebugSubscriptions(
        ble.connectedDevice.value.deviceId,
        pushDebugLog
      );
      debugSubscribed.value = true;
    } catch (error: any) {
      pushDebugLog(`Service discovery failed: ${error?.message ?? error}`);
    }
  }

  async function stopDebugSubscriptions() {
    if (!ble.connectedDevice.value) {
      debugSubscribed.value = false;
      debugSubscriptionTargets.value = [];
      return;
    }

    try {
      await stopBleDebugSubscriptions(
        ble.connectedDevice.value.deviceId,
        debugSubscriptionTargets.value,
        pushDebugLog
      );
    } catch {
      // ignore stop errors and always clean local state
    }

    debugSubscribed.value = false;
    debugSubscriptionTargets.value = [];
  }

  function clearDebugLogs() {
    debugLogs.value = [];
  }

  async function writeToFe61() {
    if (!ble.connectedDevice.value) return;
    const bytes = parseHexToUint8Array(debugHex.value);
    if (!bytes) {
      pushDebugLog('Invalid hex');
      return;
    }
    await writeToCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe61', bytes, pushDebugLog);
  }

  async function writeToFe62() {
    if (!ble.connectedDevice.value) return;
    const bytes = parseHexToUint8Array(debugHex.value);
    if (!bytes) {
      pushDebugLog('Invalid hex');
      return;
    }
    await writeToCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe62', bytes, pushDebugLog);
  }

  async function writeToFf01() {
    if (!ble.connectedDevice.value) return;
    const bytes = parseHexToUint8Array(debugHex.value);
    if (!bytes) {
      pushDebugLog('Invalid hex');
      return;
    }
    await writeFf01Blob(ble.connectedDevice.value.deviceId, bytes, pushDebugLog);
  }

  async function writeToFf02() {
    if (!ble.connectedDevice.value) return;
    const bytes = parseHexToUint8Array(debugHex.value);
    if (!bytes) {
      pushDebugLog('Invalid hex');
      return;
    }
    await writeToCharacteristicInService(ble.connectedDevice.value.deviceId, 'ff00', 'ff02', bytes, pushDebugLog);
  }

  async function readFe61() {
    if (!ble.connectedDevice.value) return;
    await readCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe61', pushDebugLog);
  }

  async function readFf01() {
    if (!ble.connectedDevice.value) return;
    await readCharacteristicInServiceByShort(ble.connectedDevice.value.deviceId, 'ff00', 'ff01', pushDebugLog);
  }

  async function readFe21InFe20() {
    if (!ble.connectedDevice.value) return;
    await readOsaChallenge(ble.connectedDevice.value.deviceId, pushDebugLog);
  }

  async function readConfigurationBlob() {
    if (!ble.connectedDevice.value) return;
    pushDebugLog('Reading configuration BLOB…');
    try {
      const result = await downloadConfigurationBlob(ble.connectedDevice.value.deviceId, pushDebugLog);
      const crc = result.computedCrc32.toString(16).padStart(8, '0').toUpperCase();
      pushDebugLog([
        `Configuration Blob: ${result.blob.length} bytes, CRC32=0x${crc}`,
        ...result.formattedLines,
      ].join('\n'));
    } catch (error: any) {
      pushDebugLog(`Configuration BLOB read failed: ${error?.message ?? error}`);
    }
  }

  async function runOsaChallengeFe20() {
    if (!ble.connectedDevice.value) return;
    await runOsaChallenge(
      ble.connectedDevice.value.deviceId,
      debugOtaAppKeyHex.value,
      debugDevEuiHex.value,
      pushDebugLog
    );
  }

  async function readFe62() {
    if (!ble.connectedDevice.value) return;
    await readCharacteristicByShort(ble.connectedDevice.value.deviceId, 'fe62', pushDebugLog);
  }

  async function dumpServices() {
    if (!ble.connectedDevice.value) return;
    try {
      await dumpBleServices(ble.connectedDevice.value.deviceId, pushDebugLog);
    } catch (error: any) {
      pushDebugLog(`Dump failed: ${error?.message ?? error}`);
    }
  }

  async function dumpServicesOnly() {
    if (!ble.connectedDevice.value) return;
    try {
      await dumpBleServicesOnly(ble.connectedDevice.value.deviceId, pushDebugLog);
    } catch (error: any) {
      pushDebugLog(`Dump failed: ${error?.message ?? error}`);
    }
  }

  async function autoFetchModelFirmware() {
    if (!ble.connectedDevice.value) {
      pushDebugLog('Not connected');
      return;
    }

    modelInfo.value = null;
    firmwareInfo.value = null;

    const result = await fetchModelFirmwareFromBle(ble.connectedDevice.value.deviceId, pushDebugLog);
    modelInfo.value = result.modelInfo;
    firmwareInfo.value = result.firmwareInfo;
  }

  async function runStoredOsaChallengeFe20() {
    if (!ble.connectedDevice.value) return;
    try {
      const stored = await OsaKeyStore.get({ devEui: debugDevEuiHex.value });
      pushDebugLog(`[OSA store] Using valid stored key for ${stored.devEui}; key hidden`);
      await runOsaChallenge(ble.connectedDevice.value.deviceId, stored.keyHex, stored.devEui, pushDebugLog);
    } catch (error: any) {
      pushDebugLog(`[OSA store] Authentication unavailable — ${error?.message ?? error}`);
    }
  }

  async function testSecureOsaStorage() {
    pushDebugLog('[OSA store] Starting persistent write/read/reuse test…');
    try {
      const devEui = debugDevEuiHex.value;
      const keyHex = debugOtaAppKeyHex.value.replace(/[^0-9a-f]/gi, '').toUpperCase();
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await OsaKeyStore.store({ devEui, keyHex, expiresAt });
      const firstRead = await OsaKeyStore.get({ devEui });
      const secondRead = await OsaKeyStore.get({ devEui });
      const verified = firstRead.keyHex === keyHex.toUpperCase() && secondRead.keyHex === firstRead.keyHex;
      pushDebugLog(`[OSA store] ${verified ? 'PASS' : 'FAIL'} — stored and read twice, expires ${new Date(firstRead.expiresAt).toLocaleString()}; key hidden`);
    } catch (error: any) {
      pushDebugLog(`[OSA store] FAIL — ${error?.message ?? error}`);
    }
  }

  async function readStoredOsaKey() {
    try {
      const stored = await OsaKeyStore.get({ devEui: debugDevEuiHex.value });
      debugOtaAppKeyHex.value = stored.keyHex;
      pushDebugLog(`[OSA store] Key loaded for ${stored.devEui}; expires ${new Date(stored.expiresAt).toLocaleString()}; key hidden`);
    } catch (error: any) { pushDebugLog(`[OSA store] Read failed — ${error?.message ?? error}`); }
  }

  async function deleteStoredOsaKey() {
    try {
      const result = await OsaKeyStore.delete({ devEui: debugDevEuiHex.value });
      pushDebugLog(`[OSA store] ${result.deleted ? 'Key deleted' : 'No key found'} for ${result.devEui}`);
    } catch (error: any) { pushDebugLog(`[OSA store] Delete failed — ${error?.message ?? error}`); }
  }

  async function purgeExpiredOsaKeys() {
    try {
      const result = await OsaKeyStore.purgeExpired();
      pushDebugLog(`[OSA store] Purged ${result.purged ?? 0} expired/invalid record(s)`);
    } catch (error: any) { pushDebugLog(`[OSA store] Purge failed — ${error?.message ?? error}`); }
  }

  watch(
    () => ble.eventsLog.value[0],
    (line) => {
      if (!options.enabled) return;
      if (!line || line === lastMirroredBleEvent.value) return;
      if (!/\bERROR\b|ATT Application Error|BLE_WRITE_ERROR/i.test(line)) return;
      lastMirroredBleEvent.value = line;
      pushDebugLog(`[TX] ${line}`);
    }
  );

  watch(
    () => ble.connected.value,
    (connectedNow) => {
      if (!options.enabled) return;
      if (connectedNow) startDebugSubscriptions();
      else stopDebugSubscriptions();
    }
  );

  onUnmounted(() => {
    if (!options.enabled) return;
    void stopDebugSubscriptions();
  });

  return {
    debugVisible,
    debugLogs,
    debugSubscribed,
    debugHex,
    debugOtaAppKeyHex,
    debugDevEuiHex,
    modelInfo,
    firmwareInfo,
    clearDebugLogs,
    startDebugSubscriptions,
    stopDebugSubscriptions,
    writeToFe61,
    writeToFe62,
    writeToFf01,
    writeToFf02,
    readFe61,
    readFf01,
    readFe21InFe20,
    readConfigurationBlob,
    runOsaChallengeFe20,
    runStoredOsaChallengeFe20,
    readFe62,
    dumpServices,
    dumpServicesOnly,
    autoFetchModelFirmware,
    testSecureOsaStorage,
    readStoredOsaKey,
    deleteStoredOsaKey,
    purgeExpiredOsaKeys,
  };
}
