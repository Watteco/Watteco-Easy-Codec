import { ref, readonly } from 'vue';
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanMode, type BleDevice, type ScanResult } from '@capacitor-community/bluetooth-le';
import { uploadConfigurationBlob } from '@/utils/BLE/blob';
import { authenticateOsa } from '@/utils/BLE/osa';
import { readProductId as readProductIdFromBle } from '@/utils/BLE/configReader';
import {
  MEASUREMENT_SOURCE_TO_ID,
  startMeasurementMonitoring,
  stopMeasurementMonitoring,
  type BleMeasurementSubscription,
} from '@/utils/BLE/measurements';
import { resolveAvailableProductReference } from '@/utils/productMeasurements';
import {
  startLoraLinkMonitoring,
  stopLoraLinkMonitoring,
  type LoraLinkSubscription,
} from '@/utils/BLE/loraLink';

type DeviceLike = {
  deviceId: string;
  name?: string;
  uuids?: readonly string[];
};

type MeasurementHistoryPoint = {
  timestamp: number;
  value: number;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SCAN_NAME_PREFIXES = ['WS', 'WTC'];

const MAX_CHUNK_SIZE = 20;   // BLE MTU-safe write size
const MAX_RETRIES = 5;
const MAX_CONNECT_ATTEMPTS = 2;
const MAX_AUTO_SCAN_ATTEMPTS = 30;
const SCAN_TIMEOUT_MS = 5000;
// Normal-mode sensors advertise every 2 minutes. Leave enough time to catch
// the next advertisement, including a small scheduling margin.
const RECONNECT_TIMEOUT_MS = 130000;
const RECONNECT_CONNECT_TIMEOUT_MS = 10000;
const RECONNECT_RETRY_DELAY_MS = 1000;
const BOND_TIMEOUT_MS = 15000;
const FLUSH_INTERVAL_MS = 1000;
const INTER_FRAME_DELAY_MS = 50;
const INTER_CHUNK_DELAY_MS = 10;
const MAX_MEASUREMENT_HISTORY_POINTS = 20;
const BONDED_DEVICES_STORAGE_KEY = 'easycodec.androidBondedDevices';
const BONDING_ENABLED = true; // set to true to enable bonding on connect

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? []);
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function hasAllowedScanPrefix(name?: string): boolean {
  if (!name) return false;
  const upperName = name.toUpperCase();
  return SCAN_NAME_PREFIXES.some(prefix => upperName.startsWith(prefix.toUpperCase()));
}

/* ------------------------------------------------------------------ */
/*  Singleton state (shared across all components)                     */
/* ------------------------------------------------------------------ */
const isNative = ref(Capacitor.isNativePlatform());
const bleInitialized = ref(false);
const scanning = ref(false);
const connected = ref(false);
const devices = ref<BleDevice[]>([]);
const connectedDevice = ref<DeviceLike | undefined>(undefined);
// Kept after an unexpected disconnect so the current page can reconnect
// without sending the user back through device discovery.
const lastConnectedDevice = ref<DeviceLike | undefined>(undefined);
const statusMessage = ref('');
const eventsLog = ref<string[]>([]);
const sending = ref(false);
const pairing = ref(false);
const connecting = ref(false);
const reconnecting = ref(false);
const bondedDevices = ref<string[]>([]);
const productReference = ref<string | null>(null);
const loraWanJoined = ref<boolean | null>(null);
const measurementValues = ref<Record<string, number | boolean | string>>({});
const measurementHistory = ref<Record<string, MeasurementHistoryPoint[]>>({});
let measurementHistoryDeviceId: string | undefined;

const receivedFrames = ref<string[]>([]);

const pending: Uint8Array[] = [];
let flushing = false;
let flushTimer: ReturnType<typeof setInterval> | undefined;
let scanTimeoutId: ReturnType<typeof setTimeout> | undefined;
let scanResolve: (() => void) | undefined;
let initialized = false;
let autoScanCanceled = false;
let connectionCanceled = false;
let connectingDevice: DeviceLike | undefined;
let reconnectCanceled = false;
let reconnectScanActive = false;
let reconnectScanTimeoutId: ReturnType<typeof setTimeout> | undefined;
let reconnectScanResolve: ((found: boolean) => void) | undefined;

let targetDeviceId: string | undefined;
let targetServiceUuid: string | undefined;
let targetCharUuid: string | undefined;
let targetNotifyCharUuid: string | undefined;
let measurementSubscriptions: BleMeasurementSubscription[] = [];
let loraLinkSubscription: LoraLinkSubscription | undefined;

/* ---- log helper ---- */
function log(msg: string) {
  const ts = new Date().toLocaleTimeString();
  eventsLog.value.unshift(`${ts} ${msg}`);
  if (eventsLog.value.length > 200) eventsLog.value.pop();
}

function prepareMeasurementHistory(deviceId: string) {
  if (measurementHistoryDeviceId === deviceId) return;
  measurementHistory.value = {};
  measurementHistoryDeviceId = deviceId;
}

function appendMeasurementHistory(measurementId: string, value: number) {
  const points = measurementHistory.value[measurementId] ?? [];
  measurementHistory.value = {
    ...measurementHistory.value,
    [measurementId]: [
      ...points,
      { timestamp: Date.now(), value },
    ].slice(-MAX_MEASUREMENT_HISTORY_POINTS),
  };
}

function clearMeasurementHistory() {
  measurementHistory.value = {};
  measurementHistoryDeviceId = undefined;
}

function isAndroidNativePlatform() {
  return isNative.value && Capacitor.getPlatform() === 'android';
}

function loadBondedDevicesFromStorage() {
  if (!isAndroidNativePlatform()) return;
  try {
    const raw = localStorage.getItem(BONDED_DEVICES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    bondedDevices.value = Array.isArray(parsed)
      ? parsed.filter((deviceId): deviceId is string => typeof deviceId === 'string')
      : [];
  } catch (e) {
    console.warn('Failed to load bonded devices from storage:', e);
    bondedDevices.value = [];
  }
}

function persistBondedDevices() {
  if (!isAndroidNativePlatform()) return;
  try {
    localStorage.setItem(BONDED_DEVICES_STORAGE_KEY, JSON.stringify(bondedDevices.value));
  } catch (e) {
    console.warn('Failed to persist bonded devices:', e);
  }
}

function rememberBondedDevice(deviceId: string) {
  if (!isAndroidNativePlatform()) return;
  if (bondedDevices.value.includes(deviceId)) return;
  bondedDevices.value = [...bondedDevices.value, deviceId];
  persistBondedDevices();
}

function forgetBondedDevice(deviceId: string) {
  if (!isAndroidNativePlatform()) return;
  if (!bondedDevices.value.includes(deviceId)) return;
  bondedDevices.value = bondedDevices.value.filter(id => id !== deviceId);
  persistBondedDevices();
}

function hasRememberedBond(deviceId: string) {
  return bondedDevices.value.includes(deviceId);
}

function clearConnectionTarget() {
  targetDeviceId = undefined;
  targetServiceUuid = undefined;
  targetCharUuid = undefined;
  targetNotifyCharUuid = undefined;
}

function handleBondInvalidation(deviceId: string, reason: string) {
  forgetBondedDevice(deviceId);
  log(`BOND RESET ${deviceId} ${reason}`);
  statusMessage.value = 'Secure pairing needs to be refreshed';
}

function isLikelyBondIssue(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return [
    'authentication',
    'encrypt',
    'bond',
    'pair',
    'insufficient',
    'gatt',
    '133',
  ].some(token => message.includes(token));
}

function isAttApplicationError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '');
  const lower = message.toLowerCase();
  if (/gatt|bonding|authentication|encryption/.test(lower)) return false;

  const match = message.match(/(?:application\s+error|error)\s+(?:0x)?([0-9a-f]{2}|\d{2,3})/i);
  if (!match) return false;

  const parsed = match[1].toLowerCase().startsWith('0x')
    ? parseInt(match[1], 16)
    : Number(match[1]);

  return Number.isFinite(parsed) && parsed >= 0x80 && parsed <= 0xff;
}

function getAttErrorCode(error: unknown): string | null {
  const message = String((error as any)?.message ?? error ?? '');
  const match = message.match(/(?:application\s+error|error)\s+(0x[0-9a-f]{2}|[0-9a-f]{2}|\d{2,3})/i);
  if (!match) return null;
  const raw = match[1];
  if (raw.toLowerCase().startsWith('0x')) return raw.toLowerCase();
  if (/^[0-9a-f]{2}$/i.test(raw)) return `0x${raw.toLowerCase()}`;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return `0x${n.toString(16).padStart(2, '0')}`;
}

function extractBleErrorCode(error: unknown): string | null {
  const err = error as any;
  const candidates = [
    err?.code,
    err?.errorCode,
    err?.status,
    err?.nativeErrorCode,
    err?.androidErrorCode,
    err?.cause?.code,
    err?.cause?.errorCode,
    err?.cause?.status,
  ];

  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'number' && Number.isFinite(value)) return `0x${value.toString(16).toLowerCase()}`;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^0x[0-9a-f]+$/i.test(trimmed)) return trimmed.toLowerCase();
      if (/^[0-9]+$/.test(trimmed)) return `0x${Number(trimmed).toString(16).toLowerCase()}`;
    }
  }

  const message = String((error as any)?.message ?? error ?? '');
  const attCode = getAttErrorCode(error);
  if (attCode) return attCode;

  const hexMatch = message.match(/0x([0-9a-f]{2,4})/i);
  if (hexMatch) return `0x${hexMatch[1].toLowerCase()}`;

  const decimalMatch = message.match(/(?:error|status|code)\s*[:=]?\s*(\d{1,5})/i);
  if (decimalMatch) {
    const value = Number(decimalMatch[1]);
    if (Number.isFinite(value)) return `0x${value.toString(16).toLowerCase()}`;
  }

  return null;
}

function debugBleWriteError(stage: 'write' | 'writeWithoutResponse' | 'frame', frameHex: string, error: unknown, attempt?: number) {
  const code = extractBleErrorCode(error);
  const message = String((error as any)?.message ?? error ?? 'Unknown BLE error');
  console.debug('[BLE_WRITE_ERROR]', {
    stage,
    attempt,
    frameHex,
    code,
    message,
    raw: error,
  });
}

async function isDeviceBonded(deviceId: string): Promise<boolean> {
  if (!BONDING_ENABLED) return false;
  if (!isAndroidNativePlatform()) return false;
  try {
    const isBonded = await BleClient.isBonded(deviceId);
    if (isBonded) rememberBondedDevice(deviceId);
    else forgetBondedDevice(deviceId);
    return isBonded;
  } catch (e) {
    console.warn('Bond state check failed:', e);
    if (hasRememberedBond(deviceId)) {
      log(`KNOWN BOND ${deviceId}`);
    }
    return false;
  }
}

async function ensureBonded(deviceId: string, force = false): Promise<boolean> {
  if (!BONDING_ENABLED) return false;
  if (!isAndroidNativePlatform()) return false;

  if (!force) {
    if (hasRememberedBond(deviceId)) {
      statusMessage.value = 'Reusing secure pairing…';
    }
    const alreadyBonded = await isDeviceBonded(deviceId);
    if (alreadyBonded) return false;
  }

  pairing.value = true;
  statusMessage.value = force ? 'Refreshing secure pairing…' : 'Pairing device…';

  try {
    await BleClient.createBond(deviceId, { timeout: BOND_TIMEOUT_MS });
    rememberBondedDevice(deviceId);
    statusMessage.value = 'Secure pairing completed';
    return true;
  } catch (e: any) {
    forgetBondedDevice(deviceId);
    statusMessage.value = 'Pairing failed: ' + (e?.message ?? e);
    throw e;
  } finally {
    pairing.value = false;
  }
}

/* ================================================================== */
/*  Init                                                               */
/* ================================================================== */
async function initialize() {
  if (!isNative.value) return;
  if (initialized) return;
  initialized = true;
  try {
    await BleClient.initialize();
    loadBondedDevicesFromStorage();
    bleInitialized.value = true;
    statusMessage.value = 'BLE initialized';
    flushTimer = setInterval(() => flushPending(), FLUSH_INTERVAL_MS);
  } catch (e) {
    console.error('BLE init failed:', e);
    statusMessage.value = 'BLE not available';
  }
}

/* ================================================================== */
/*  Scan                                                               */
/* ================================================================== */
async function startScan(useFilters = true) {
  if (!bleInitialized.value) { statusMessage.value = 'BLE not ready'; return; }
  devices.value = [];
  scanning.value = true;
  statusMessage.value = 'Scanning…';

  // Promise that resolves when this scan attempt ends (via stopScan)
  const prom = new Promise<void>((resolve) => { scanResolve = resolve; });

  try {
    const options: any = {};
    if (useFilters && SCAN_NAME_PREFIXES.length === 1) {
      options.namePrefix = SCAN_NAME_PREFIXES[0];
    }
    await BleClient.requestLEScan(options, (result: ScanResult) => {
      if (useFilters && !hasAllowedScanPrefix(result.device.name)) {
        return;
      }
      if (!devices.value.find(d => d.deviceId === result.device.deviceId)) {
        devices.value = [...devices.value, result.device];
      }
    });
    scanTimeoutId = setTimeout(() => stopScan(), SCAN_TIMEOUT_MS);
  } catch (e: any) {
    statusMessage.value = 'Scan failed: ' + (e?.message ?? e);
    scanning.value = false;
    if (scanResolve) { scanResolve(); scanResolve = undefined; }
  }

  return prom;
}

async function stopScan() {
  if (!scanning.value) return;
  try { await BleClient.stopLEScan(); } catch { /* ignore stop scan errors */ }
  if (scanTimeoutId) { clearTimeout(scanTimeoutId); scanTimeoutId = undefined; }
  scanning.value = false;
  statusMessage.value = `Found ${devices.value.length} device(s)`;
  if (scanResolve) { scanResolve(); scanResolve = undefined; }
}

async function startAutoScan(useFilters = true, maxAttempts = MAX_AUTO_SCAN_ATTEMPTS) {
  if (!bleInitialized.value) { statusMessage.value = 'BLE not ready'; return; }
  if (scanning.value) return; // already scanning
  devices.value = [];
  autoScanCanceled = false;
  scanning.value = true;
  statusMessage.value = 'Auto-scanning…';

  const attemptDuration = SCAN_TIMEOUT_MS;
  const totalDuration = Math.max(1, maxAttempts) * attemptDuration;
  let attempts = 0;
  let scanFailed = false;

  try {
    const options: any = {};
    if (useFilters && SCAN_NAME_PREFIXES.length === 1) options.namePrefix = SCAN_NAME_PREFIXES[0];

    await BleClient.requestLEScan(options, async (result: ScanResult) => {
      if (useFilters && !hasAllowedScanPrefix(result.device.name)) {
        return;
      }
      if (!devices.value.find(d => d.deviceId === result.device.deviceId)) {
        devices.value = [...devices.value, result.device];
      }
      // stop early when we detected at least one device
      /*if (devices.value.length > 0 && scanning.value) {
        try { await stopScan(); } catch { /* ignore stop scan errors  }
      }*/
    });

    // update attempt counter periodically to avoid UI flicker
    const attemptTimer = setInterval(() => {
      attempts++;
      if (attempts >= maxAttempts) return;
      statusMessage.value = `Auto-scanning… (attempt ${attempts}/${maxAttempts})`;
    }, attemptDuration);

    // stop after total duration unless canceled or devices found
    scanTimeoutId = setTimeout(async () => {
      try { await stopScan(); } catch { /* ignore stop scan errors */ }
    }, totalDuration);

    // wait until scan stops (stopScan resolves scanResolve)
    await new Promise<void>((resolve) => { scanResolve = resolve; });

    clearInterval(attemptTimer);
  } catch (e: any) {
    scanFailed = true;
    statusMessage.value = 'Auto-scan failed: ' + (e?.message ?? e);
  } finally {
    if (scanTimeoutId) { clearTimeout(scanTimeoutId); scanTimeoutId = undefined; }
    scanning.value = false;
    if (!scanFailed) {
      statusMessage.value = `Found ${devices.value.length} device(s) after ${Math.min(attempts || 1, maxAttempts)} attempt(s)`;
    }
    autoScanCanceled = false;
  }
}

async function cancelScan() {
  autoScanCanceled = true;
  await stopScan();
}

/* ================================================================== */
/*  Connect / Disconnect                                               */
/* ================================================================== */
async function connectToDeviceUntil(
  device: DeviceLike,
  connectionDeadline?: number,
  isCanceled?: () => boolean
) {
  if (connectedDevice.value?.deviceId !== device.deviceId) productReference.value = null;
  prepareMeasurementHistory(device.deviceId);
  await stopMeasurementMonitoring(device.deviceId, measurementSubscriptions, log);
  await stopLoraLinkMonitoring(device.deviceId, loraLinkSubscription, log);
  measurementValues.value = {};
  measurementSubscriptions = [];
  loraLinkSubscription = undefined;
  loraWanJoined.value = null;
  statusMessage.value = hasRememberedBond(device.deviceId)
    ? `Reconnecting to ${device.name || device.deviceId}…`
    : `Connecting to ${device.name || device.deviceId}…`;
  clearConnectionTarget();
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    if (isCanceled?.()) return;
    const retryingInvalidBond = attempt > 1;
    try {
      if (isAndroidNativePlatform()) {
        await ensureBonded(device.deviceId, retryingInvalidBond);
      }
      if (isCanceled?.()) return;

      const connectionOptions = connectionDeadline === undefined
        ? undefined
        : { timeout: Math.max(1, connectionDeadline - Date.now()) };
      await BleClient.connect(device.deviceId, () => {
        void stopMeasurementMonitoring(device.deviceId, measurementSubscriptions, log);
        measurementSubscriptions = [];
        loraLinkSubscription = undefined;
        loraWanJoined.value = null;
        connected.value = false;
        connectedDevice.value = undefined;
        clearConnectionTarget();
        pairing.value = false;
        statusMessage.value = 'Device disconnected';
      }, connectionOptions);

      if (isCanceled?.()) {
        try { await BleClient.disconnect(device.deviceId); } catch { /* ignore cancellation cleanup errors */ }
        return;
      }

      connectedDevice.value = device;
      lastConnectedDevice.value = device;

      const productId = await readProductIdFromBle(device.deviceId, log);
      productReference.value = resolveAvailableProductReference(productId?.text);
      if (productId?.text && productReference.value) {
        log(`ProductID ${productId.text} selected as ${productReference.value}`);
      } else {
        log('ProductID unavailable; no product selected automatically');
      }

      try {
        measurementSubscriptions = await startMeasurementMonitoring(
          device.deviceId,
          (sample) => {
            const measurementId = MEASUREMENT_SOURCE_TO_ID[sample.sourceId];
            if (!measurementId) {
              log(`[MEAS] Unknown source 0x${sample.sourceId.toString(16).padStart(4, '0')}`);
              return;
            }
            measurementValues.value = {
              ...measurementValues.value,
              [measurementId]: sample.value,
            };
            if (typeof sample.value === 'number') {
              appendMeasurementHistory(measurementId, sample.value);
            }
          },
          log
        );
      } catch (error: any) {
        log(`[MEAS] Discovery failed: ${error?.message ?? error}`);
      }

      try {
        loraLinkSubscription = await startLoraLinkMonitoring(
          device.deviceId,
          joined => { loraWanJoined.value = joined; },
          log
        );
      } catch (error: any) {
        log(`[LORA] Discovery failed: ${error?.message ?? error}`);
      }

      if (isAndroidNativePlatform()) {
        rememberBondedDevice(device.deviceId);
      }
      statusMessage.value = `Connected to ${device.name || device.deviceId}`;

      try {
        const services = await BleClient.getServices(device.deviceId);
        let foundService: any;
        let foundChar: any;

        for (const s of services) {
          if (s.uuid?.toLowerCase().includes('fe60')) { foundService = s; break; }
        }
        if (!foundService) {
          for (const s of services) {
            if (s.characteristics) {
              const w = s.characteristics.find((c: any) =>
                c.properties && (c.properties.write || c.properties.writeWithoutResponse));
              if (w) { foundService = s; foundChar = w; break; }
            }
          }
        }
        if (foundService && !foundChar && foundService.characteristics) {
          foundChar = foundService.characteristics.find((c: any) =>
            c.properties && (c.properties.write || c.properties.writeWithoutResponse));
        }
        // Look for a notify/indicate characteristic in the same service
        let notifyChar: any;
        if (foundService?.characteristics) {
          notifyChar = foundService.characteristics.find((c: any) =>
            c.properties && (c.properties.notify || c.properties.indicate));
        }

        if (foundService && foundChar) {
          targetDeviceId = device.deviceId;
          targetServiceUuid = foundService.uuid;
          targetCharUuid = foundChar.uuid;
          targetNotifyCharUuid = notifyChar?.uuid;

          if (notifyChar) {
            try {
              await BleClient.startNotifications(
                device.deviceId,
                foundService.uuid,
                notifyChar.uuid,
                (value: DataView) => {
                  const bytes = new Uint8Array(value.buffer);
                  const hex = toHex(bytes);
                  log(`NOTIF ${hex}`);
                  receivedFrames.value = [hex, ...receivedFrames.value].slice(0, 50);
                }
              );
              statusMessage.value += ' (ready, notifications on)';
            } catch (ne) {
              console.warn('startNotifications failed:', ne);
              statusMessage.value += ' (ready, notifications failed)';
            }
          } else {
            statusMessage.value += ' (ready)';
          }
        } else {
          console.warn('No writable HMI characteristic found');
          statusMessage.value += ' (no writable char)';
        }
      } catch (e) {
        console.warn('Service discovery failed:', e);
      }

      if (isCanceled?.()) {
        await stopMeasurementMonitoring(device.deviceId, measurementSubscriptions, log);
        measurementSubscriptions = [];
        await stopLoraLinkMonitoring(device.deviceId, loraLinkSubscription, log);
        loraLinkSubscription = undefined;
        loraWanJoined.value = null;
        try { await BleClient.disconnect(device.deviceId); } catch { /* ignore cancellation cleanup errors */ }
        connectedDevice.value = undefined;
        clearConnectionTarget();
        return;
      }

      // Expose the connection only once its services and notifications are
      // ready, so the UI can navigate straight to the sensor dashboard.
      if (!isCanceled?.() && connectedDevice.value?.deviceId === device.deviceId) {
        connected.value = true;
      }
      return;
    } catch (e: any) {
      if (isAndroidNativePlatform() && attempt < MAX_CONNECT_ATTEMPTS && (hasRememberedBond(device.deviceId) || isLikelyBondIssue(e))) {
        handleBondInvalidation(device.deviceId, e?.message ?? String(e));
        try { await BleClient.disconnect(device.deviceId); } catch { /* ignore retry cleanup errors */ }
        clearConnectionTarget();
        connected.value = false;
        connectedDevice.value = undefined;
        continue;
      }
      statusMessage.value = 'Connection failed: ' + (e?.message ?? e);
      return;
    }
  }
}

async function connectToDevice(device: DeviceLike): Promise<boolean> {
  if (connected.value) return true;
  if (connecting.value) return false;

  // Device discovery and the targeted connection scan cannot run at the same
  // time on the native BLE stack.
  await cancelScan();
  connectionCanceled = false;
  connectingDevice = device;
  connecting.value = true;

  try {
    const connectionDeadline = Date.now() + RECONNECT_TIMEOUT_MS;

    // Keep the fast path for a sensor that is still in the advertising window
    // in which it was discovered.
    await connectToDeviceUntil(
      device,
      Date.now() + RECONNECT_CONNECT_TIMEOUT_MS,
      () => connectionCanceled,
    );
    if (connected.value) return true;

    // Normal-mode sensors only advertise once every 120 seconds. Listen for
    // the next window, then retry the GATT connection while the sensor is awake.
    while (!connectionCanceled && Date.now() < connectionDeadline) {
      const deviceIsAdvertising = await waitForTargetAdvertisement(
        device,
        connectionDeadline,
        () => connectionCanceled,
      );
      if (connectionCanceled) return false;

      if (deviceIsAdvertising) {
        await connectToDeviceUntil(
          device,
          Date.now() + RECONNECT_CONNECT_TIMEOUT_MS,
          () => connectionCanceled,
        );
        if (connected.value) return true;
      }

      const remainingTime = connectionDeadline - Date.now();
      if (remainingTime > 0) {
        await delay(Math.min(RECONNECT_RETRY_DELAY_MS, remainingTime));
      }
    }

    if (!connectionCanceled) statusMessage.value = 'Connection failed: timeout';
    return false;
  } finally {
    finishReconnectScan(false);
    if (reconnectScanActive) {
      reconnectScanActive = false;
      try { await BleClient.stopLEScan(); } catch { /* ignore connection scan cleanup errors */ }
    }
    if (connectionCanceled) statusMessage.value = 'Connection canceled';
    connecting.value = false;
    connectingDevice = undefined;
  }
}

async function cancelConnect() {
  if (!connecting.value) return;

  connectionCanceled = true;
  finishReconnectScan(false);

  if (reconnectScanActive) {
    reconnectScanActive = false;
    try { await BleClient.stopLEScan(); } catch { /* ignore connection scan cancellation errors */ }
  }

  if (connectingDevice) {
    try { await BleClient.disconnect(connectingDevice.deviceId); } catch { /* ignore pending connection cancellation errors */ }
  }
  statusMessage.value = 'Connection canceled';
}

async function disconnect() {
  if (!connectedDevice.value) return;
  await stopMeasurementMonitoring(
    connectedDevice.value.deviceId,
    measurementSubscriptions,
    log
  );
  measurementSubscriptions = [];
  await stopLoraLinkMonitoring(connectedDevice.value.deviceId, loraLinkSubscription, log);
  loraLinkSubscription = undefined;
  loraWanJoined.value = null;
  try {
    await BleClient.disconnect(connectedDevice.value.deviceId);
  } catch (e) { console.error('Disconnect error:', e); }
  connected.value = false;
  connectedDevice.value = undefined;
  clearMeasurementHistory();
  clearConnectionTarget();
  pairing.value = false;
  statusMessage.value = 'Disconnected';
}

function finishReconnectScan(found: boolean) {
  if (reconnectScanTimeoutId) {
    clearTimeout(reconnectScanTimeoutId);
    reconnectScanTimeoutId = undefined;
  }
  const resolve = reconnectScanResolve;
  reconnectScanResolve = undefined;
  resolve?.(found);
}

async function waitForTargetAdvertisement(
  device: DeviceLike,
  deadline: number,
  isCanceled: () => boolean,
): Promise<boolean> {
  const remainingTime = deadline - Date.now();
  if (isCanceled() || remainingTime <= 0) return false;

  statusMessage.value = `Waiting for ${device.name || device.deviceId}…`;
  const resultPromise = new Promise<boolean>((resolve) => {
    reconnectScanResolve = resolve;
    reconnectScanTimeoutId = setTimeout(() => finishReconnectScan(false), remainingTime);
  });

  try {
    await BleClient.requestLEScan({
      allowDuplicates: true,
      scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
    }, (result: ScanResult) => {
      if (result.device.deviceId === device.deviceId) {
        log(`RECONNECT FOUND ${device.deviceId}`);
        finishReconnectScan(true);
      }
    });
    reconnectScanActive = true;
    if (isCanceled()) finishReconnectScan(false);
    return await resultPromise;
  } catch (error: any) {
    log(`RECONNECT SCAN ERROR ${error?.message ?? error}`);
    finishReconnectScan(false);
    return false;
  } finally {
    finishReconnectScan(false);
    if (reconnectScanActive) {
      reconnectScanActive = false;
      try { await BleClient.stopLEScan(); } catch { /* ignore reconnect scan cleanup errors */ }
    }
  }
}

async function cancelReconnect() {
  if (!reconnecting.value) return;

  reconnectCanceled = true;
  finishReconnectScan(false);

  if (reconnectScanActive) {
    reconnectScanActive = false;
    try { await BleClient.stopLEScan(); } catch { /* ignore reconnect scan cancellation errors */ }
  }

  const deviceId = lastConnectedDevice.value?.deviceId;
  if (deviceId) {
    try { await BleClient.disconnect(deviceId); } catch { /* ignore pending connection cancellation errors */ }
  }
  statusMessage.value = 'Reconnection canceled';
}

async function reconnectToLastDevice(): Promise<boolean> {
  if (connected.value) return true;
  if (reconnecting.value) {
    await cancelReconnect();
    return false;
  }

  const device = lastConnectedDevice.value;
  if (!device) {
    statusMessage.value = 'No previously connected device';
    return false;
  }

  reconnectCanceled = false;
  reconnecting.value = true;
  try {
    const reconnectDeadline = Date.now() + RECONNECT_TIMEOUT_MS;
    do {
      const deviceIsAdvertising = await waitForTargetAdvertisement(
        device,
        reconnectDeadline,
        () => reconnectCanceled,
      );
      if (reconnectCanceled) return false;

      if (!deviceIsAdvertising) {
        const remainingTime = reconnectDeadline - Date.now();
        if (remainingTime > 0) {
          await delay(Math.min(RECONNECT_RETRY_DELAY_MS, remainingTime));
        }
        continue;
      }

      // If the advertisement arrives near the end of the scan window, still
      // grant the actual GATT connection its complete timeout.
      const connectionDeadline = Date.now() + RECONNECT_CONNECT_TIMEOUT_MS;
      await connectToDeviceUntil(device, connectionDeadline, () => reconnectCanceled);
      if (connected.value) return true;

      const remainingTime = reconnectDeadline - Date.now();
      if (remainingTime > 0) {
        await delay(Math.min(RECONNECT_RETRY_DELAY_MS, remainingTime));
      }
    } while (Date.now() < reconnectDeadline);

    return false;
  } finally {
    finishReconnectScan(false);
    if (reconnectScanActive) {
      reconnectScanActive = false;
      try { await BleClient.stopLEScan(); } catch { /* ignore reconnect scan cleanup errors */ }
    }
    if (reconnectCanceled) statusMessage.value = 'Reconnection canceled';
    reconnecting.value = false;
  }
}

/* ================================================================== */
/*  Write-queue                                                        */
/* ================================================================== */
function enqueueHexFrames(hexArray: string[]) {
  for (const hex of hexArray) {
    const bytes = hexToBytes(hex);
    pending.push(bytes);
    log(`QUEUED ${toHex(bytes)}`);
  }
  setTimeout(() => flushPending(), 0);
}

async function flushPending() {
  if (!targetDeviceId || !targetServiceUuid || !targetCharUuid) return;
  if (pending.length === 0) return;
  if (flushing) return;

  flushing = true;
  sending.value = true;
  try {
    while (pending.length > 0) {
      const frame = pending.shift()!;
      try {
        await writeFrame(frame);
        log(`ACK   ${toHex(frame)}`);
      } catch (err: any) {
        const code = extractBleErrorCode(err);
        log(`ERROR ${toHex(frame)} ${err?.message ?? err}${code ? ` (code ${code})` : ''}`);
        debugBleWriteError('frame', toHex(frame), err);
      }
      await delay(INTER_FRAME_DELAY_MS);
    }
  } finally {
    flushing = false;
    sending.value = false;
  }
}

async function writeFrame(frame: Uint8Array) {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < frame.length; i += MAX_CHUNK_SIZE) {
    chunks.push(frame.slice(i, i + MAX_CHUNK_SIZE));
  }
  for (const chunk of chunks) {
    await writeChunkWithRetries(chunk);
    await delay(INTER_CHUNK_DELAY_MS);
  }
}

async function writeChunkWithRetries(chunk: Uint8Array) {
  if (!targetDeviceId || !targetServiceUuid || !targetCharUuid) {
    throw new Error('No target characteristic set');
  }
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt === 1 && await isDeviceBonded(targetDeviceId) === false) {
      await ensureBonded(targetDeviceId);
    }

    try {
      const dv = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      await BleClient.write(targetDeviceId, targetServiceUuid, targetCharUuid, dv);
      return;
    } catch (e) {
      lastError = e;
      debugBleWriteError('write', toHex(chunk), lastError, attempt);

      if (isAttApplicationError(lastError)) {
        const errorCode = getAttErrorCode(lastError) ?? '0x??';
        throw new Error(`ATT Application Error ${errorCode}: Command rejected by device (no retry)`);
      }

      try {
        const dv = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        await BleClient.writeWithoutResponse(targetDeviceId, targetServiceUuid, targetCharUuid, dv);
        return;
      } catch (e2) {
        lastError = e2;
        debugBleWriteError('writeWithoutResponse', toHex(chunk), lastError, attempt);
      }

      if (isAttApplicationError(lastError)) {
        const errorCode = getAttErrorCode(lastError) ?? '0x??';
        throw new Error(`ATT Application Error ${errorCode}: Command rejected by device (no retry)`);
      }

      if (attempt === 1 && (await isDeviceBonded(targetDeviceId) === false || hasRememberedBond(targetDeviceId) || isLikelyBondIssue(lastError))) {
        handleBondInvalidation(targetDeviceId, (lastError as any)?.message ?? String(lastError));
        await ensureBonded(targetDeviceId, true);
        continue;
      }
    }
    await delay(50 * attempt);
  }
  throw lastError ?? new Error('Write failed');
}

/* ================================================================== */
/*  High-level: send frames from output area                           */
/* ================================================================== */
async function sendOutputFrames(osaKeyHex: string, devEuiHex: string, activateAfterCommit = true): Promise<number> {
  const deviceId = connectedDevice.value?.deviceId;
  if (!connected.value || !deviceId) {
    statusMessage.value = 'Not connected to a BLE device';
    return -1;
  }
  const outputArea = document.getElementById('outputArea');
  if (!outputArea) return 0;

  const text = (outputArea.innerText || outputArea.textContent || '').replace(/ /g, '');
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  const validFrames: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/\s+/g, '');
    if (/^[0-9a-fA-F]+$/.test(clean) && clean.length >= 2 && clean.length % 2 === 0) {
      validFrames.push(clean);
    }
  }
  if (validFrames.length === 0) {
    statusMessage.value = 'No valid frames to send';
    return 0;
  }
  if (sending.value) return 0;

  sending.value = true;
  statusMessage.value = 'Authenticating configuration transfer…';
  try {
    await authenticateOsa(deviceId, osaKeyHex, devEuiHex, log);
    statusMessage.value = `Sending ${validFrames.length} configuration frame(s)…`;
    await uploadConfigurationBlob(deviceId, validFrames, log, activateAfterCommit);
    statusMessage.value = activateAfterCommit
      ? 'Configuration committed; sensor is restarting'
      : 'Configuration stored without activation';
    return validFrames.length;
  } catch (error: any) {
    const message = error?.message ?? String(error);
    log(`BLOB ERROR ${message}`);
    statusMessage.value = `Configuration transfer failed: ${message}`;
    return -1;
  } finally {
    sending.value = false;
  }
}

function getDeviceName(device: DeviceLike): string {
  return device.name || device.deviceId.substring(0, 8) + '…';
}

function setProductReference(value?: string | null) {
  productReference.value = resolveAvailableProductReference(value);
}

/* ================================================================== */
/*  Composable (returns singleton state)                               */
/* ================================================================== */
export function useBle() {
  return {
    receivedFrames:   readonly(receivedFrames),
    isNative:        readonly(isNative),
    bleInitialized:  readonly(bleInitialized),
    scanning:        readonly(scanning),
    connected:       readonly(connected),
    devices:         readonly(devices),
    connectedDevice: readonly(connectedDevice),
    lastConnectedDevice: readonly(lastConnectedDevice),
    statusMessage,
    eventsLog:       readonly(eventsLog),
    sending:         readonly(sending),
    pairing:         readonly(pairing),
    connecting:      readonly(connecting),
    reconnecting:    readonly(reconnecting),
    bondedDevices:   readonly(bondedDevices),
    productReference: readonly(productReference),
    loraWanJoined: readonly(loraWanJoined),
    measurementValues: readonly(measurementValues),
    measurementHistory: readonly(measurementHistory),

    initialize,
    startScan,
    startAutoScan,
    cancelScan,
    stopScan,
    connectToDevice,
    cancelConnect,
    reconnectToLastDevice,
    cancelReconnect,
    disconnect,
    sendOutputFrames,
    getDeviceName,
    setProductReference,
  };
}
