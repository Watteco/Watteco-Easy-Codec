import { computed, ref, shallowRef, watch, onUnmounted, toValue } from 'vue';
import type { MaybeRef } from 'vue';
import { alertController } from '@ionic/vue';
import {
  startDebugSubscriptions as startBleDebugSubscriptions,
  stopDebugSubscriptions as stopBleDebugSubscriptions,
  dumpServices as dumpBleServices,
  dumpServicesOnly as dumpBleServicesOnly,
  inspectLoraLinkCharacteristics,
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
import {
  autoFetchModelFirmware as fetchModelFirmwareFromBle,
  readProductId as readProductIdFromBle,
} from '@/utils/BLE/configReader';
import { OsaKeyStore } from '@/plugins/osaKeyStore';
import {
  updateDebugDevEuiFromDeviceName,
  useBleDebugCredentials,
} from '@/composables/useBleDebugCredentials';
import { runFirmwareUpdateProbe } from '@/utils/BLE/firmwareUpdateProbe';
import {
  dryRunFirmwareImage,
  formatFirmwareDryRun,
  type FirmwareDryRunResult,
} from '@/utils/BLE/firmwareImage';
import {
  runFirmwareUpdateTransfer,
  type FirmwareUpdateProgress,
} from '@/utils/BLE/firmwareUpdateTransfer';
import { writeFirmwareDiagnosticLine } from '@/utils/BLE/firmwareUpdateDiagnostics';
import {
  clearFirmwareRecoveryDevice,
  loadFirmwareRecoveryDevice,
  saveFirmwareRecoveryDevice,
  type FirmwareRecoveryDevice,
} from '@/utils/BLE/firmwareUpdateRecovery';

type UseBleDebugOptions = {
  enabled: MaybeRef<boolean>;
};

export { updateDebugDevEuiFromDeviceName, useBleDebugCredentials } from '@/composables/useBleDebugCredentials';

const { debugOtaAppKeyHex, debugDevEuiHex } = useBleDebugCredentials();

export function useBleDebug(ble: any, options: UseBleDebugOptions) {
  const isEnabled = () => toValue(options.enabled);
  const debugVisible = ref(false);
  const debugLogs = ref<string[]>([]);
  const debugSubscribed = ref(false);
  const otaProbeRunning = ref(false);
  const firmwareFile = ref<File | null>(null);
  const firmwareMetadataFile = ref<File | null>(null);
  const firmwareDryRunRunning = ref(false);
  const firmwareDryRunResult = shallowRef<FirmwareDryRunResult | null>(null);
  const firmwareUpdateRunning = ref(false);
  const firmwareUpdateProgress = ref('');
  const firmwareUpdateError = ref('');
  const firmwareUpdateStatus = shallowRef<FirmwareUpdateProgress | null>(null);
  const firmwareTransferRateBps = ref(0);
  const firmwareRecoveryDevice = ref<FirmwareRecoveryDevice | null>(loadFirmwareRecoveryDevice());
  if (!debugDevEuiHex.value && firmwareRecoveryDevice.value?.devEuiHex) {
    debugDevEuiHex.value = firmwareRecoveryDevice.value.devEuiHex;
  }
  const lastMirroredBleEvent = ref<string>('');
  const debugSubscriptionTargets = ref<BleSubscriptionTarget[]>([]);

  const debugHex = ref('01');
  const modelInfo = ref<string | null>(null);
  const firmwareInfo = ref<string | null>(null);

  const pushDebugLog = (line: string) => {
    debugLogs.value.unshift(line);
    if (debugLogs.value.length > 200) debugLogs.value.pop();
    const belongsToFirmwareWorkflow = /^\[(?:FW dry-run|FW update|OTA probe)\]/.test(line)
      || otaProbeRunning.value
      || firmwareDryRunRunning.value
      || firmwareUpdateRunning.value;
    if (belongsToFirmwareWorkflow) writeFirmwareDiagnosticLine(line);
  };

  async function startDebugSubscriptions() {
    if (!isEnabled()) return;
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

  async function writeToLoraLinkTest() {
    if (!ble.connectedDevice.value) return;
    const bytes = parseHexToUint8Array(debugHex.value);
    if (!bytes) {
      pushDebugLog('Invalid hex');
      return;
    }
    await writeToCharacteristicInService(
      ble.connectedDevice.value.deviceId,
      '8002',
      'c002',
      bytes,
      pushDebugLog,
      true,
    );
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

  async function readLoraLinkInfo() {
    if (!ble.connectedDevice.value) return;
    try {
      await inspectLoraLinkCharacteristics(ble.connectedDevice.value.deviceId, pushDebugLog);
    } catch (error: any) {
      pushDebugLog(`LoRa link inspection failed: ${error?.message ?? error}`);
    }
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
    return runOsaChallenge(
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

  async function readProductId() {
    if (!ble.connectedDevice.value) return;
    await readProductIdFromBle(ble.connectedDevice.value.deviceId, pushDebugLog);
  }

  async function runStoredOsaChallengeFe20() {
    if (!ble.connectedDevice.value) return;
    try {
      const stored = await OsaKeyStore.get({ devEui: debugDevEuiHex.value });
      pushDebugLog(`[OSA store] Using valid stored key for ${stored.devEui}; key hidden`);
      return await runOsaChallenge(ble.connectedDevice.value.deviceId, stored.keyHex, stored.devEui, pushDebugLog);
    } catch (error: any) {
      pushDebugLog(`[OSA store] Authentication unavailable - ${error?.message ?? error}`);
      return false;
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
      pushDebugLog(`[OSA store] ${verified ? 'PASS' : 'FAIL'} - stored and read twice, expires ${new Date(firstRead.expiresAt).toLocaleString()}; key hidden`);
    } catch (error: any) {
      pushDebugLog(`[OSA store] FAIL - ${error?.message ?? error}`);
    }
  }

  async function readStoredOsaKey() {
    try {
      const stored = await OsaKeyStore.get({ devEui: debugDevEuiHex.value });
      debugOtaAppKeyHex.value = stored.keyHex;
      pushDebugLog(`[OSA store] Key loaded for ${stored.devEui}; expires ${new Date(stored.expiresAt).toLocaleString()}; key hidden`);
    } catch (error: any) { pushDebugLog(`[OSA store] Read failed - ${error?.message ?? error}`); }
  }

  async function deleteStoredOsaKey() {
    try {
      const result = await OsaKeyStore.delete({ devEui: debugDevEuiHex.value });
      pushDebugLog(`[OSA store] ${result.deleted ? 'Key deleted' : 'No key found'} for ${result.devEui}`);
    } catch (error: any) { pushDebugLog(`[OSA store] Delete failed - ${error?.message ?? error}`); }
  }

  async function purgeExpiredOsaKeys() {
    try {
      const result = await OsaKeyStore.purgeExpired();
      pushDebugLog(`[OSA store] Purged ${result.purged ?? 0} expired/invalid record(s)`);
    } catch (error: any) { pushDebugLog(`[OSA store] Purge failed - ${error?.message ?? error}`); }
  }

  async function probeOtaLoader() {
    if (!isEnabled() || otaProbeRunning.value) return;
    const device = ble.connectedDevice.value;
    if (!ble.connected.value || !device?.deviceId || !device.name) {
      pushDebugLog('[OTA probe] A named application device must be connected');
      return;
    }

    otaProbeRunning.value = true;
    try {
      await stopDebugSubscriptions();
      await runFirmwareUpdateProbe({
        applicationDeviceId: device.deviceId,
        applicationName: device.name,
        osaKeyHex: debugOtaAppKeyHex.value,
        devEuiHex: debugDevEuiHex.value,
        onLog: pushDebugLog,
        expectApplicationRestart: ble.expectDeviceRestart,
        cancelExpectedApplicationRestart: ble.cancelExpectedDeviceRestart,
      });
    } catch (error: any) {
      pushDebugLog(`[OTA probe] FAIL: ${error?.message ?? error}`);
    } finally {
      otaProbeRunning.value = false;
    }
  }

  function selectFirmwareFile(file: File | null) {
    firmwareFile.value = file;
    firmwareDryRunResult.value = null;
    firmwareUpdateProgress.value = '';
    firmwareUpdateError.value = '';
    firmwareUpdateStatus.value = null;
    firmwareTransferRateBps.value = 0;
    if (file) pushDebugLog(`[FW dry-run] Selected firmware: ${file.name}`);
  }

  function selectFirmwareMetadataFile(file: File | null) {
    firmwareMetadataFile.value = file;
    firmwareDryRunResult.value = null;
    firmwareUpdateProgress.value = '';
    firmwareUpdateError.value = '';
    firmwareUpdateStatus.value = null;
    firmwareTransferRateBps.value = 0;
    pushDebugLog(file
      ? `[FW dry-run] Selected metadata: ${file.name}`
      : '[FW dry-run] Metadata cleared');
  }

  async function runFirmwareDryRun() {
    if (!isEnabled() || firmwareDryRunRunning.value) return;
    const selectedFirmware = firmwareFile.value;
    if (!selectedFirmware) {
      pushDebugLog('[FW dry-run] Select a .bin, .hex, or .ihex firmware first');
      return;
    }

    firmwareDryRunRunning.value = true;
    try {
      const raw = new Uint8Array(await selectedFirmware.arrayBuffer());
      const metadataText = firmwareMetadataFile.value
        ? await firmwareMetadataFile.value.text()
        : undefined;
      const result = await dryRunFirmwareImage(selectedFirmware.name, raw, metadataText);
      firmwareDryRunResult.value = result;
      for (const line of formatFirmwareDryRun(result).reverse()) pushDebugLog(line);
    } catch (error: any) {
      firmwareDryRunResult.value = null;
      pushDebugLog(`[FW dry-run] FAIL: ${error?.message ?? error}`);
    } finally {
      firmwareDryRunRunning.value = false;
    }
  }

  function formatUpdateProgress(progress: FirmwareUpdateProgress): string {
    if (progress.phase === 'transfer') {
      return `${progress.percent}% (${progress.transferred}/${progress.total} bytes)`;
    }
    return progress.phase;
  }

  async function confirmDestructiveFirmwareUpdate(result: FirmwareDryRunResult): Promise<boolean> {
    const alert = await alertController.create({
      header: 'Start firmware update?',
      message: [
        `Profile: ${result.layout.systemProfile}`,
        `Firmware: ${result.image.fileName}`,
        `Transfer: ${result.image.transferSize} bytes`,
        `Protected mask: 0x${result.image.protectedMask.toString(16).padStart(2, '0').toUpperCase()}`,
        '',
        'PREPARE will erase Flash. There is no rollback. Keep the app open and the sensor powered.',
      ].join('<br>'),
      backdropDismiss: false,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Start update', role: 'destructive' },
      ],
    });
    await alert.present();
    const resultEvent = await alert.onDidDismiss();
    return resultEvent.role === 'destructive';
  }

  async function startFirmwareUpdate() {
    if (!isEnabled() || firmwareUpdateRunning.value) return;
    const selectedFirmware = firmwareFile.value;
    const rememberedDevice = ble.connectedDevice.value
      ?? (firmwareRecoveryDevice.value?.loaderDeviceId
        ? firmwareRecoveryDevice.value
        : ble.lastConnectedDevice.value ?? firmwareRecoveryDevice.value);
    if (!selectedFirmware || !rememberedDevice?.deviceId || !rememberedDevice.name) {
      const message = 'A firmware and a known application device are required';
      firmwareUpdateError.value = message;
      pushDebugLog(`[FW update] ${message}`);
      return;
    }

    firmwareUpdateRunning.value = true;
    firmwareUpdateProgress.value = 'validating';
    firmwareUpdateError.value = '';
    firmwareUpdateStatus.value = null;
    firmwareTransferRateBps.value = 0;
    let transferStartedAt: number | undefined;
    let screenWakeLock: { release(): Promise<void> } | undefined;
    try {
      const raw = new Uint8Array(await selectedFirmware.arrayBuffer());
      const metadataText = firmwareMetadataFile.value
        ? await firmwareMetadataFile.value.text()
        : undefined;
      const result = await dryRunFirmwareImage(selectedFirmware.name, raw, metadataText);
      firmwareDryRunResult.value = result;
      if (!result.metadataVerified) {
        throw new Error('A verified .sha256.json sidecar is mandatory for a real update');
      }
      if (!await confirmDestructiveFirmwareUpdate(result)) {
        firmwareUpdateProgress.value = 'canceled';
        pushDebugLog('[FW update] Canceled before reboot; Flash was not modified');
        return;
      }

      const selectedLoader = firmwareRecoveryDevice.value?.deviceId === rememberedDevice.deviceId
        ? firmwareRecoveryDevice.value
        : null;
      firmwareRecoveryDevice.value = {
        deviceId: rememberedDevice.deviceId,
        name: rememberedDevice.name,
        devEuiHex: debugDevEuiHex.value,
        ...(selectedLoader
          ? {
            loaderDeviceId: selectedLoader.loaderDeviceId,
            loaderName: selectedLoader.loaderName,
          }
          : {}),
      };
      saveFirmwareRecoveryDevice(firmwareRecoveryDevice.value);

      try {
        const wakeLock = (navigator as Navigator & {
          wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
        }).wakeLock;
        screenWakeLock = await wakeLock?.request('screen');
        if (screenWakeLock) pushDebugLog('[FW update] Screen wake lock acquired');
      } catch {
        pushDebugLog('[FW update] Screen wake lock unavailable; keep the app visible');
      }

      if (ble.connected.value) await stopDebugSubscriptions();
      await runFirmwareUpdateTransfer({
        applicationDeviceId: rememberedDevice.deviceId,
        applicationName: rememberedDevice.name,
        applicationConnected: ble.connected.value && ble.connectedDevice.value?.deviceId === rememberedDevice.deviceId,
        osaKeyHex: debugOtaAppKeyHex.value,
        devEuiHex: debugDevEuiHex.value,
        image: result.image,
        loaderDevice: firmwareRecoveryDevice.value?.loaderDeviceId
          ? {
            deviceId: firmwareRecoveryDevice.value.loaderDeviceId,
            name: firmwareRecoveryDevice.value.loaderName,
          }
          : undefined,
        onLog: pushDebugLog,
        onProgress: progress => {
          firmwareUpdateStatus.value = progress;
          if (progress.phase === 'transfer') {
            if (progress.transferred === 0 || transferStartedAt === undefined) {
              transferStartedAt = performance.now();
              firmwareTransferRateBps.value = 0;
            } else {
              const elapsedSeconds = (performance.now() - transferStartedAt) / 1000;
              firmwareTransferRateBps.value = elapsedSeconds > 0
                ? progress.transferred / elapsedSeconds
                : 0;
            }
          }
          firmwareUpdateProgress.value = formatUpdateProgress(progress);
        },
        reconnectApplication: async () => {
          const reconnected = await ble.reconnectToLastDevice();
          if (reconnected) await stopDebugSubscriptions();
          return reconnected;
        },
        expectApplicationRestart: ble.expectDeviceRestart,
        cancelExpectedApplicationRestart: ble.cancelExpectedDeviceRestart,
      });
      clearFirmwareRecoveryDevice();
      firmwareRecoveryDevice.value = null;
    } catch (error: any) {
      firmwareUpdateError.value = error?.message ?? String(error);
      pushDebugLog(`[FW update] FAIL: ${firmwareUpdateError.value}`);
      pushDebugLog('[FW update] If PREPARE was accepted, keep the same firmware selected and press Start update again to resume the active loader');
    } finally {
      try { await screenWakeLock?.release(); } catch { /* already released */ }
      firmwareUpdateRunning.value = false;
    }
  }

  watch(
    () => ble.eventsLog.value[0],
    (line) => {
      if (!isEnabled()) return;
      if (!line || line === lastMirroredBleEvent.value) return;
      if (!/\bERROR\b|ATT Application Error|BLE_WRITE_ERROR/i.test(line)) return;
      lastMirroredBleEvent.value = line;
      pushDebugLog(`[TX] ${line}`);
    }
  );

  watch(
    () => ble.connected.value,
    (connectedNow) => {
      if (!isEnabled()) return;
      if (connectedNow) startDebugSubscriptions();
      else stopDebugSubscriptions();
    }
  );

  watch(
    () => ble.connectedDevice.value?.name,
    (deviceName) => {
      if (!updateDebugDevEuiFromDeviceName(deviceName)) return;
      pushDebugLog(`[OSA] DevEUI inferred from ${deviceName}: ${debugDevEuiHex.value}`);
    },
    { immediate: true }
  );

  watch(
    isEnabled,
    (enabled) => {
      if (enabled) {
        void startDebugSubscriptions();
      } else {
        debugVisible.value = false;
        void stopDebugSubscriptions();
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    void stopDebugSubscriptions();
  });

  return {
    debugVisible,
    debugLogs,
    debugSubscribed,
    otaProbeRunning,
    firmwareFileName: computed(() => firmwareFile.value?.name ?? ''),
    firmwareMetadataFileName: computed(() => firmwareMetadataFile.value?.name ?? ''),
    firmwareDryRunRunning,
    firmwareUpdateAvailable: computed(() => (
      firmwareDryRunResult.value?.metadataVerified === true
      && Boolean(ble.connectedDevice.value ?? ble.lastConnectedDevice.value ?? firmwareRecoveryDevice.value)
    )),
    firmwareUpdateRunning,
    firmwareUpdateProgress,
    firmwareUpdateError,
    firmwareUpdateStatus,
    firmwareTransferRateBps,
    debugHex,
    debugOtaAppKeyHex,
    debugDevEuiHex,
    modelInfo,
    firmwareInfo,
    pushDebugLog,
    clearDebugLogs,
    startDebugSubscriptions,
    stopDebugSubscriptions,
    writeToFe61,
    writeToFe62,
    writeToFf01,
    writeToFf02,
    writeToLoraLinkTest,
    readFe61,
    readFf01,
    readFe21InFe20,
    readLoraLinkInfo,
    readConfigurationBlob,
    runOsaChallengeFe20,
    runStoredOsaChallengeFe20,
    readFe62,
    dumpServices,
    dumpServicesOnly,
    readProductId,
    autoFetchModelFirmware,
    testSecureOsaStorage,
    readStoredOsaKey,
    deleteStoredOsaKey,
    purgeExpiredOsaKeys,
    probeOtaLoader,
    selectFirmwareFile,
    selectFirmwareMetadataFile,
    runFirmwareDryRun,
    startFirmwareUpdate,
  };
}
