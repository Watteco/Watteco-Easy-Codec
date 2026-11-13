import {
  BleClient,
  ScanMode,
  type BleDevice,
  type ScanResult,
} from '@capacitor-community/bluetooth-le';
import { authenticateOsa } from '@/utils/BLE/osa';
import {
  ADMIN_REBOOT_CHAR_UUID,
  OSA_ADMIN_SERVICE_UUID,
  normalizeUuid,
} from '@/utils/BLE/characteristics';
import { findCharacteristicByUuid } from '@/utils/BLE/connection';
import { isExpectedRestartDisconnect } from '@/utils/BLE/deviceCommands';
import {
  buildOtaRebootCommand,
  deriveOtaLoaderName,
  STM32WB_55CE512K_FIRST_SECTOR,
  STM32WB_55CE512K_SECTOR_COUNT,
  STM_OTA_SERVICE_UUID,
} from '@/utils/BLE/firmwareUpdateProtocol';
import { toSpacedHex } from '@/utils/BLE/blob';

const OTA_SCAN_TIMEOUT_MS = 15_000;
const OTA_CONNECT_TIMEOUT_MS = 25_000;
const OSA_RETRY_DELAY_MS = 750;

type FirmwareUpdateProbeOptions = {
  applicationDeviceId: string;
  applicationName: string;
  osaKeyHex: string;
  devEuiHex: string;
  onLog: (line: string) => void;
  expectApplicationRestart?: (deviceId: string) => void;
  cancelExpectedApplicationRestart?: (deviceId: string) => void;
};

const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

async function scanForOtaLoader(otaName: string, onLog: (line: string) => void): Promise<BleDevice> {
  onLog(`[OTA probe] Scanning ${otaName} for ${OTA_SCAN_TIMEOUT_MS / 1000}s`);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<BleDevice>((resolve, reject) => {
      let settled = false;
      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        action();
      };

      timeoutId = setTimeout(() => {
        settle(() => reject(new Error(`OTA loader ${otaName} was not found`)));
      }, OTA_SCAN_TIMEOUT_MS);

      void BleClient.requestLEScan({
        namePrefix: 'WS',
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
      }, (result: ScanResult) => {
        const advertisedName = result.localName ?? result.device.name;
        if (advertisedName?.trim().toUpperCase() !== otaName.toUpperCase()) return;
        settle(() => {
          onLog(`[OTA probe] Found ${otaName} (${result.device.deviceId})`);
          resolve(result.device);
        });
      }).catch(error => settle(() => reject(error)));
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    try {
      await BleClient.stopLEScan();
    } catch {
      // The scan may already have stopped after an adapter or connection event.
    }
  }
}

async function authenticateOtaLoader(
  deviceId: string,
  osaKeyHex: string,
  devEuiHex: string,
  onLog: (line: string) => void,
): Promise<void> {
  let firstError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await authenticateOsa(deviceId, osaKeyHex, devEuiHex, onLog);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      firstError = error;
      onLog('[OTA probe] Initial encrypted access did not complete; retrying after Android pairing');
      await delay(OSA_RETRY_DELAY_MS);
    }
  }
  throw firstError;
}

export async function runFirmwareUpdateProbe(options: FirmwareUpdateProbeOptions): Promise<void> {
  const {
    applicationDeviceId,
    applicationName,
    osaKeyHex,
    devEuiHex,
    onLog,
    expectApplicationRestart,
    cancelExpectedApplicationRestart,
  } = options;
  const otaName = deriveOtaLoaderName(applicationName);
  if (!otaName) throw new Error(`Cannot derive an OTA loader name from ${applicationName || 'the device'}`);

  onLog('[OTA probe] Authenticating the running application');
  await authenticateOsa(applicationDeviceId, osaKeyHex, devEuiHex, onLog);

  const rebootCharacteristic = await findCharacteristicByUuid(
    applicationDeviceId,
    OSA_ADMIN_SERVICE_UUID,
    ADMIN_REBOOT_CHAR_UUID,
    onLog,
  );
  if (!rebootCharacteristic) throw new Error('Admin reboot characteristic C005 is unavailable');
  if (!rebootCharacteristic.props.write) {
    throw new Error('Admin reboot characteristic C005 does not support writes with response');
  }

  const rebootCommand = buildOtaRebootCommand(
    STM32WB_55CE512K_FIRST_SECTOR,
    STM32WB_55CE512K_SECTOR_COUNT,
    0,
  );
  onLog(`[OTA probe] Reboot request: ${toSpacedHex(rebootCommand)} (no prepare command will be sent)`);
  expectApplicationRestart?.(applicationDeviceId);
  try {
    const value = new DataView(rebootCommand.buffer, rebootCommand.byteOffset, rebootCommand.byteLength);
    await BleClient.write(
      applicationDeviceId,
      rebootCharacteristic.service,
      rebootCharacteristic.characteristic,
      value,
    );
  } catch (error) {
    if (!isExpectedRestartDisconnect(error)) {
      cancelExpectedApplicationRestart?.(applicationDeviceId);
      throw error;
    }
    onLog('[OTA probe] Application disconnected while acknowledging the OTA reboot request');
  }

  const otaDevice = await scanForOtaLoader(otaName, onLog);
  let otaConnected = false;
  let otaDisconnected = false;
  try {
    onLog('[OTA probe] Connecting without creating a durable bond');
    await BleClient.connect(otaDevice.deviceId, () => {
      otaDisconnected = true;
      onLog('[OTA probe] Loader disconnected');
    }, { timeout: OTA_CONNECT_TIMEOUT_MS });
    otaConnected = true;

    await authenticateOtaLoader(otaDevice.deviceId, osaKeyHex, devEuiHex, onLog);

    const services = await BleClient.getServices(otaDevice.deviceId);
    const serviceUuids = new Set(services.map(service => normalizeUuid(service.uuid)));
    if (!serviceUuids.has(OSA_ADMIN_SERVICE_UUID)) {
      throw new Error('OTA loader Admin service was not discovered');
    }
    if (!serviceUuids.has(STM_OTA_SERVICE_UUID)) {
      throw new Error('OTA loader STM_OTA service FE20 was not discovered');
    }
    onLog('[OTA probe] PASS: encrypted OTA OSA session and FE20 service confirmed');
  } finally {
    if (otaConnected && !otaDisconnected) {
      try {
        await BleClient.disconnect(otaDevice.deviceId);
      } catch {
        // The loader can reset or close the temporary link first.
      }
    }
  }
}
