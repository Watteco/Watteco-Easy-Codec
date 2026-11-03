import {
  BleClient,
  ConnectionPriority,
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
import type { FirmwareImagePlan, FirmwareRegion } from '@/utils/BLE/firmwareImage';
import {
  buildBeginPageCommand,
  buildCommitPageCommand,
  buildFinishCommand,
  buildOtaRebootCommand,
  buildPrepareCommand,
  crc32,
  deriveOtaLoaderName,
  STM_OTA_BASE_ADDRESS_CHAR_UUID,
  STM_OTA_CONFIRMATION_CHAR_UUID,
  STM_OTA_FAILURES,
  STM_OTA_FLASH_PAGE_SIZE,
  STM_OTA_PAGE_ACK,
  STM_OTA_PAGE_RETRY,
  STM_OTA_RAW_DATA_CHAR_UUID,
  STM_OTA_RAW_DATA_MAX,
  STM_OTA_REBOOT_CONFIRMED,
  STM_OTA_SERVICE_UUID,
  STM_OTA_UPDATE_PREPARED,
} from '@/utils/BLE/firmwareUpdateProtocol';
import { toSpacedHex } from '@/utils/BLE/blob';

const OTA_RESUME_PROBE_MS = 3_000;
const OTA_SCAN_TIMEOUT_MS = 15_000;
const APPLICATION_VERIFY_TIMEOUT_MS = 130_000;
const OTA_CONNECT_TIMEOUT_MS = 25_000;
const PREPARE_TIMEOUT_MS = 30_000;
const CONFIRMATION_TIMEOUT_MS = 20_000;
const PAGE_RETRY_COUNT = 3;
const GATT_CCCD_UUID = '00002902-0000-1000-8000-00805f9b34fb';

export type FirmwareUpdateProgress = {
  phase: 'resume-probe' | 'application-connect' | 'application' | 'loader' | 'prepare' | 'transfer' | 'finish' | 'verify';
  transferred: number;
  total: number;
  percent: number;
};

type FirmwareUpdateTransferOptions = {
  applicationDeviceId: string;
  applicationName: string;
  applicationConnected: boolean;
  osaKeyHex: string;
  devEuiHex: string;
  image: FirmwareImagePlan;
  loaderDevice?: BleDevice;
  onLog: (line: string) => void;
  onProgress: (progress: FirmwareUpdateProgress) => void;
  reconnectApplication?: () => Promise<boolean>;
  expectApplicationRestart?: (deviceId: string) => void;
  cancelExpectedApplicationRestart?: (deviceId: string) => void;
};

class DeviceNotFoundError extends Error {}

class IndicationQueue {
  private values: Uint8Array[] = [];
  private waiter: ((value: Uint8Array) => void) | undefined;
  private waiterReject: ((reason: Error) => void) | undefined;
  private failure: Error | undefined;

  push(value: Uint8Array): void {
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = undefined;
      this.waiterReject = undefined;
      waiter(value);
    } else {
      this.values.push(value);
    }
  }

  async next(timeoutMs: number): Promise<Uint8Array> {
    if (this.failure) throw this.failure;
    const queued = this.values.shift();
    if (queued) return queued;
    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiter = undefined;
        this.waiterReject = undefined;
        reject(new Error('Timed out waiting for STM_OTA indication'));
      }, timeoutMs);
      this.waiter = value => {
        clearTimeout(timeout);
        resolve(value);
      };
      this.waiterReject = reason => {
        clearTimeout(timeout);
        reject(reason);
      };
    });
  }

  fail(reason: Error): void {
    this.failure = reason;
    const reject = this.waiterReject;
    this.waiter = undefined;
    this.waiterReject = undefined;
    reject?.(reason);
  }
}

type LoaderConnection = {
  deviceId: string;
  disconnected: boolean;
  onDisconnect?: () => void;
};

const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

function dataView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function indicationFailure(data: Uint8Array): Error | null {
  if (data.length !== 1 || STM_OTA_FAILURES[data[0]] === undefined) return null;
  return new Error(`STM_OTA failure 0x${data[0].toString(16).padStart(2, '0').toUpperCase()}: ${STM_OTA_FAILURES[data[0]]}`);
}

async function waitForSingleByte(
  indications: IndicationQueue,
  expected: number,
  timeoutMs: number,
): Promise<void> {
  const indication = await indications.next(timeoutMs);
  const failure = indicationFailure(indication);
  if (failure) throw failure;
  if (indication.length !== 1 || indication[0] !== expected) {
    throw new Error(`Unexpected STM_OTA indication: ${toSpacedHex(indication)}`);
  }
}

async function scanForNamedDevice(
  name: string,
  timeoutMs: number,
  onLog: (line: string) => void,
): Promise<BleDevice> {
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
        settle(() => reject(new DeviceNotFoundError(`${name} was not found`)));
      }, timeoutMs);
      void BleClient.requestLEScan({
        namePrefix: 'WS',
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
      }, (result: ScanResult) => {
        const advertisedName = result.localName ?? result.device.name;
        if (advertisedName?.trim().toUpperCase() !== name.toUpperCase()) return;
        settle(() => resolve(result.device));
      }).catch(error => settle(() => reject(error)));
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    try {
      await BleClient.stopLEScan();
    } catch {
      // Ignore cleanup errors after a completed or failed native scan.
    }
  }
}

async function requestLoaderFromApplication(
  options: FirmwareUpdateTransferOptions,
): Promise<void> {
  const { image, onLog } = options;
  onLog('[FW update] Authenticating the running application');
  await authenticateOsa(
    options.applicationDeviceId,
    options.osaKeyHex,
    options.devEuiHex,
    onLog,
  );
  const rebootCharacteristic = await findCharacteristicByUuid(
    options.applicationDeviceId,
    OSA_ADMIN_SERVICE_UUID,
    ADMIN_REBOOT_CHAR_UUID,
    onLog,
  );
  if (!rebootCharacteristic?.props.write) {
    throw new Error('Admin reboot characteristic C005 with write response is unavailable');
  }
  const command = buildOtaRebootCommand(image.firstSector, image.sectorCount, image.protectedMask);
  onLog(`[FW update] Reboot OTA: ${toSpacedHex(command)}`);
  options.expectApplicationRestart?.(options.applicationDeviceId);
  try {
    await BleClient.write(
      options.applicationDeviceId,
      rebootCharacteristic.service,
      rebootCharacteristic.characteristic,
      dataView(command),
    );
  } catch (error) {
    if (!isExpectedRestartDisconnect(error)) {
      options.cancelExpectedApplicationRestart?.(options.applicationDeviceId);
      throw error;
    }
    onLog('[FW update] Application disconnected while acknowledging the reboot request');
  }
}

async function authenticateLoader(
  deviceId: string,
  options: FirmwareUpdateTransferOptions,
): Promise<void> {
  let firstError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await authenticateOsa(deviceId, options.osaKeyHex, options.devEuiHex, options.onLog);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      firstError = error;
      options.onLog('[FW update] Retrying OSA after Android temporary pairing');
      await delay(750);
    }
  }
  throw firstError;
}

async function connectLoader(
  device: BleDevice,
  options: FirmwareUpdateTransferOptions,
): Promise<LoaderConnection> {
  const connection: LoaderConnection = { deviceId: device.deviceId, disconnected: false };
  await BleClient.connect(device.deviceId, () => {
    connection.disconnected = true;
    connection.onDisconnect?.();
    options.onLog('[FW update] Loader disconnected');
  }, { timeout: OTA_CONNECT_TIMEOUT_MS });
  try {
    await authenticateLoader(device.deviceId, options);
    const services = await BleClient.getServices(device.deviceId);
    const serviceUuids = new Set(services.map(service => normalizeUuid(service.uuid)));
    if (!serviceUuids.has(OSA_ADMIN_SERVICE_UUID) || !serviceUuids.has(STM_OTA_SERVICE_UUID)) {
      throw new Error('Required Admin or STM_OTA service was not discovered');
    }
    return connection;
  } catch (error) {
    if (!connection.disconnected) {
      try { await BleClient.disconnect(device.deviceId); } catch { /* ignore cleanup */ }
    }
    throw error;
  }
}

function* flashPages(region: FirmwareRegion): Generator<FirmwareRegion> {
  let offset = 0;
  while (offset < region.data.length) {
    const address = region.address + offset;
    const size = Math.min(
      STM_OTA_FLASH_PAGE_SIZE - (address % STM_OTA_FLASH_PAGE_SIZE),
      region.data.length - offset,
    );
    yield { address, data: region.data.slice(offset, offset + size) };
    offset += size;
  }
}

async function waitForPageResult(
  indications: IndicationQueue,
  address: number,
  expectedCrc: number,
): Promise<boolean> {
  const indication = await indications.next(CONFIRMATION_TIMEOUT_MS);
  const failure = indicationFailure(indication);
  if (failure) throw failure;
  if (indication.length !== 9 || ![STM_OTA_PAGE_ACK, STM_OTA_PAGE_RETRY].includes(indication[0])) {
    throw new Error(`Unexpected page indication: ${toSpacedHex(indication)}`);
  }
  const view = new DataView(indication.buffer, indication.byteOffset, indication.byteLength);
  const confirmedAddress = view.getUint32(1, true);
  const confirmedCrc = view.getUint32(5, true);
  if (confirmedAddress !== address) {
    throw new Error(`Page ACK address mismatch: 0x${confirmedAddress.toString(16)} != 0x${address.toString(16)}`);
  }
  if (indication[0] === STM_OTA_PAGE_RETRY) return false;
  if (confirmedCrc !== expectedCrc) {
    throw new Error(`Page ACK CRC mismatch at 0x${address.toString(16)}`);
  }
  return true;
}

async function transferImage(
  connection: LoaderConnection,
  options: FirmwareUpdateTransferOptions,
): Promise<void> {
  const { deviceId } = connection;
  const { image, onLog, onProgress } = options;
  const indications = new IndicationQueue();
  let prepareAcknowledgedAt: number | undefined;
  connection.onDisconnect = () => {
    if (prepareAcknowledgedAt !== undefined) {
      onLog(`[FW update] Loader disconnected ${Math.round(performance.now() - prepareAcknowledgedAt)} ms after PREPARE write acknowledgement`);
    }
    indications.fail(new Error('Loader disconnected while waiting for STM_OTA indication'));
  };
  let notificationsStarted = false;
  let rebootConfirmed = false;
  onLog('[FW update] Subscribing to FE23 indications');
  await BleClient.startNotifications(
    deviceId,
    STM_OTA_SERVICE_UUID,
    STM_OTA_CONFIRMATION_CHAR_UUID,
    value => {
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      onLog(`[FW update] Indication: ${toSpacedHex(bytes)}`);
      indications.push(bytes.slice());
    },
  );
  notificationsStarted = true;
  onLog('[FW update] FE23 indication subscription established');

  try {
    // FE23 is indication-only. Verify the actual remote CCCD before PREPARE:
    // 0x0002 means indications are enabled. Abort before Flash erase if the
    // Android GATT stack did not apply the subscription as requested.
    const cccdValue = await BleClient.readDescriptor(
      deviceId,
      STM_OTA_SERVICE_UUID,
      STM_OTA_CONFIRMATION_CHAR_UUID,
      GATT_CCCD_UUID,
    );
    const cccd = new Uint8Array(
      cccdValue.buffer,
      cccdValue.byteOffset,
      cccdValue.byteLength,
    );
    onLog(`[FW update] FE23 CCCD after subscription: ${toSpacedHex(cccd)}`);
    if (cccd.length !== 2 || cccd[0] !== 0x02 || cccd[1] !== 0x00) {
      throw new Error(`STM_OTA FE23 indications are not enabled (CCCD=${toSpacedHex(cccd)})`);
    }

    onProgress({ phase: 'prepare', transferred: 0, total: image.transferSize, percent: 0 });
    const prepare = buildPrepareCommand(image.firstSector, image.sectorCount, image.protectedMask);
    const prepareStarted = performance.now();
    onLog(`[FW update] PREPARE: ${toSpacedHex(prepare)} — Flash erase starts now`);
    // Arm the waiter before sending 09: the revised loader may emit 02 before
    // Android completes the write-with-response Promise.
    const preparedPromise = waitForSingleByte(
      indications,
      STM_OTA_UPDATE_PREPARED,
      PREPARE_TIMEOUT_MS,
    );
    const prepareWritePromise = BleClient.write(
      deviceId,
      STM_OTA_SERVICE_UUID,
      STM_OTA_BASE_ADDRESS_CHAR_UUID,
      dataView(prepare),
    ).then(() => {
      prepareAcknowledgedAt = performance.now();
      onLog(`[FW update] PREPARE write acknowledged after ${Math.round(prepareAcknowledgedAt - prepareStarted)} ms`);
    });
    await Promise.all([prepareWritePromise, preparedPromise]);
    onLog(`[FW update] Loader prepared after ${Math.round(performance.now() - prepareStarted)} ms; starting page transfer`);

    try {
      await BleClient.requestConnectionPriority(
        deviceId,
        ConnectionPriority.CONNECTION_PRIORITY_HIGH,
      );
    } catch {
      onLog('[FW update] Android high connection priority request was not accepted; continuing');
    }

    let mtu = 23;
    try { mtu = await BleClient.getMtu(deviceId); } catch { /* use ATT default */ }
    if (!Number.isFinite(mtu) || mtu < 23) mtu = 23;
    const chunkSize = Math.max(1, Math.min(mtu - 3, STM_OTA_RAW_DATA_MAX));
    onLog(`[FW update] MTU=${mtu}; raw chunk=${chunkSize} bytes`);

    let transferred = 0;
    let nextLoggedPercent = 0;
    onProgress({ phase: 'transfer', transferred: 0, total: image.transferSize, percent: 0 });
    for (const region of image.transferRegions) {
      for (const page of flashPages(region)) {
        const expectedCrc = crc32(page.data);
        let accepted = false;
        for (let attempt = 1; attempt <= PAGE_RETRY_COUNT; attempt++) {
          await BleClient.write(
            deviceId,
            STM_OTA_SERVICE_UUID,
            STM_OTA_BASE_ADDRESS_CHAR_UUID,
            dataView(buildBeginPageCommand(page.address, page.data)),
          );
          for (let offset = 0; offset < page.data.length; offset += chunkSize) {
            const chunk = page.data.slice(offset, offset + chunkSize);
            await BleClient.writeWithoutResponse(
              deviceId,
              STM_OTA_SERVICE_UUID,
              STM_OTA_RAW_DATA_CHAR_UUID,
              dataView(chunk),
            );
          }
          await BleClient.write(
            deviceId,
            STM_OTA_SERVICE_UUID,
            STM_OTA_BASE_ADDRESS_CHAR_UUID,
            dataView(buildCommitPageCommand()),
          );
          accepted = await waitForPageResult(indications, page.address, expectedCrc);
          if (accepted) break;
          onLog(`[FW update] Page 0x${page.address.toString(16).toUpperCase()} rejected; retry ${attempt}/${PAGE_RETRY_COUNT}`);
        }
        if (!accepted) {
          throw new Error(`Page 0x${page.address.toString(16).toUpperCase()} failed after ${PAGE_RETRY_COUNT} attempts`);
        }
        transferred += page.data.length;
        const percent = Math.floor((transferred * 100) / image.transferSize);
        onProgress({ phase: 'transfer', transferred, total: image.transferSize, percent });
        if (percent >= nextLoggedPercent || transferred === image.transferSize) {
          onLog(`[FW update] Data: ${transferred}/${image.transferSize} bytes (${percent}%)`);
          nextLoggedPercent = Math.floor(percent / 5) * 5 + 5;
        }
      }
    }

    onProgress({ phase: 'finish', transferred, total: image.transferSize, percent: 100 });
    for (let attempt = 1; attempt <= 2; attempt++) {
      await BleClient.write(
        deviceId,
        STM_OTA_SERVICE_UUID,
        STM_OTA_BASE_ADDRESS_CHAR_UUID,
        dataView(buildFinishCommand()),
      );
      try {
        await waitForSingleByte(indications, STM_OTA_REBOOT_CONFIRMED, CONFIRMATION_TIMEOUT_MS / 2);
        rebootConfirmed = true;
        break;
      } catch (error) {
        if (connection.disconnected) {
          onLog('[FW update] Loader reset after FINISH; application scan will verify the result');
          rebootConfirmed = true;
          break;
        }
        if (attempt === 2) throw error;
        onLog('[FW update] No FINISH confirmation yet; retrying');
      }
    }
  } finally {
    connection.onDisconnect = undefined;
    if (notificationsStarted && !rebootConfirmed && !connection.disconnected) {
      try {
        await BleClient.stopNotifications(deviceId, STM_OTA_SERVICE_UUID, STM_OTA_CONFIRMATION_CHAR_UUID);
      } catch {
        // Ignore notification cleanup after an OTA error or link loss.
      }
    }
  }
}

export async function runFirmwareUpdateTransfer(options: FirmwareUpdateTransferOptions): Promise<void> {
  const otaName = deriveOtaLoaderName(options.applicationName);
  if (!otaName) throw new Error(`Cannot derive OTA loader name from ${options.applicationName}`);
  const total = options.image.transferSize;
  options.onProgress({ phase: 'resume-probe', transferred: 0, total, percent: 0 });
  options.onLog(`[FW update] Looking for an active recovery loader ${otaName}`);

  let otaDevice: BleDevice;
  if (options.loaderDevice) {
    otaDevice = options.loaderDevice;
    options.onLog(`[FW update] Using selected recovery loader ${otaName} (${otaDevice.deviceId})`);
  } else {
    try {
      otaDevice = await scanForNamedDevice(otaName, OTA_RESUME_PROBE_MS, options.onLog);
      options.onLog(`[FW update] Active loader found; resuming directly (${otaDevice.deviceId})`);
    } catch (error) {
      if (!(error instanceof DeviceNotFoundError)) throw error;
      if (!options.applicationConnected) {
        options.onProgress({ phase: 'application-connect', transferred: 0, total, percent: 0 });
        options.onLog(`[FW update] Application ${options.applicationName} is disconnected; starting the app reconnection workflow`);
        if (!options.reconnectApplication || !await options.reconnectApplication()) {
          throw new Error(`Could not reconnect to application ${options.applicationName}`);
        }
        options.onLog(`[FW update] Application ${options.applicationName} reconnected`);
      }
      options.onProgress({ phase: 'application', transferred: 0, total, percent: 0 });
      await requestLoaderFromApplication(options);
      options.onLog(`[FW update] Scanning for ${otaName}`);
      otaDevice = await scanForNamedDevice(otaName, OTA_SCAN_TIMEOUT_MS, options.onLog);
    }
  }

  options.onProgress({ phase: 'loader', transferred: 0, total, percent: 0 });
  options.onLog(`[FW update] Connecting to ${otaName} without a durable bond`);
  const connection = await connectLoader(otaDevice, options);
  let transferCompleted = false;
  try {
    await transferImage(connection, options);
    transferCompleted = true;
  } finally {
    if (!transferCompleted && !connection.disconnected) {
      try { await BleClient.disconnect(connection.deviceId); } catch { /* expected after reset */ }
    }
  }

  options.onProgress({ phase: 'verify', transferred: total, total, percent: 100 });
  options.onLog(`[FW update] Waiting for updated application ${options.applicationName}`);
  const application = await scanForNamedDevice(
    options.applicationName,
    APPLICATION_VERIFY_TIMEOUT_MS,
    options.onLog,
  );
  options.onLog(`[FW update] SUCCESS: updated application is advertising (${application.deviceId})`);
}
