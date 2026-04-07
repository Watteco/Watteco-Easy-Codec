import { ref, readonly } from 'vue';
import { Capacitor } from '@capacitor/core';
import { BleClient, type BleDevice, type ScanResult } from '@capacitor-community/bluetooth-le';

type DeviceLike = {
  deviceId: string;
  name?: string;
  uuids?: readonly string[];
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const DEFAULT_SERVICE_UUIDS = [
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000180f-0000-1000-8000-00805f9b34fb',   // Battery Service
  '0000fe60-cc7a-482a-984a-7f2ed5b3e58f',   // HMI service (custom base)
  'fe60',
];

const MAX_CHUNK_SIZE = 20;   // BLE MTU-safe write size
const MAX_RETRIES = 5;
const MAX_CONNECT_ATTEMPTS = 2;
const MAX_AUTO_SCAN_ATTEMPTS = 30;
const SCAN_TIMEOUT_MS = 5000;
const BOND_TIMEOUT_MS = 15000;
const FLUSH_INTERVAL_MS = 1000;
const INTER_FRAME_DELAY_MS = 50;
const INTER_CHUNK_DELAY_MS = 10;
const BONDED_DEVICES_STORAGE_KEY = 'easycodec.androidBondedDevices';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? []);
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeUuid(s: string): string {
  if (/^[0-9a-f]{4}$/i.test(s)) {
    return `0000${s.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
  }
  return s;
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/*  Singleton state (shared across all components)                     */
/* ------------------------------------------------------------------ */
const isNative = ref(Capacitor.isNativePlatform());
const bleInitialized = ref(false);
const scanning = ref(false);
const connected = ref(false);
const devices = ref<BleDevice[]>([]);
const connectedDevice = ref<DeviceLike | undefined>(undefined);
const statusMessage = ref('');
const eventsLog = ref<string[]>([]);
const sending = ref(false);
const pairing = ref(false);
const bondedDevices = ref<string[]>([]);

const pending: Uint8Array[] = [];
let flushing = false;
let flushTimer: ReturnType<typeof setInterval> | undefined;
let scanTimeoutId: ReturnType<typeof setTimeout> | undefined;
let scanResolve: (() => void) | undefined;
let initialized = false;
let autoScanCanceled = false;

let targetDeviceId: string | undefined;
let targetServiceUuid: string | undefined;
let targetCharUuid: string | undefined;

/* ---- log helper ---- */
function log(msg: string) {
  const ts = new Date().toLocaleTimeString();
  eventsLog.value.unshift(`${ts} ${msg}`);
  if (eventsLog.value.length > 50) eventsLog.value.pop();
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

async function isDeviceBonded(deviceId: string): Promise<boolean> {
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
    if (useFilters) {
      options.services = DEFAULT_SERVICE_UUIDS.map(normalizeUuid);
    }
    await BleClient.requestLEScan(options, (result: ScanResult) => {
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

  try {
    const options: any = {};
    if (useFilters) options.services = DEFAULT_SERVICE_UUIDS.map(normalizeUuid);

    await BleClient.requestLEScan(options, async (result: ScanResult) => {
      if (!devices.value.find(d => d.deviceId === result.device.deviceId)) {
        devices.value = [...devices.value, result.device];
      }
      // stop early when we detected at least one device
      if (devices.value.length > 0 && scanning.value) {
        try { await stopScan(); } catch { /* ignore stop scan errors */ }
      }
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
    statusMessage.value = 'Auto-scan failed: ' + (e?.message ?? e);
  } finally {
    if (scanTimeoutId) { clearTimeout(scanTimeoutId); scanTimeoutId = undefined; }
    scanning.value = false;
    statusMessage.value = `Found ${devices.value.length} device(s) after ${Math.min(attempts || 1, maxAttempts)} attempt(s)`;
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
async function connectToDevice(device: DeviceLike) {
  statusMessage.value = hasRememberedBond(device.deviceId)
    ? `Reconnecting to ${device.name || device.deviceId}…`
    : `Connecting to ${device.name || device.deviceId}…`;
  clearConnectionTarget();
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    const retryingInvalidBond = attempt > 1;
    try {
      if (isAndroidNativePlatform()) {
        await ensureBonded(device.deviceId, retryingInvalidBond);
      }

      await BleClient.connect(device.deviceId, () => {
        connected.value = false;
        connectedDevice.value = undefined;
        clearConnectionTarget();
        pairing.value = false;
        statusMessage.value = 'Device disconnected';
      });

      connected.value = true;
      connectedDevice.value = device;
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
        if (foundService && foundChar) {
          targetDeviceId = device.deviceId;
          targetServiceUuid = foundService.uuid;
          targetCharUuid = foundChar.uuid;
          statusMessage.value += ' (ready)';
        } else {
          console.warn('No writable HMI characteristic found');
          statusMessage.value += ' (no writable char)';
        }
      } catch (e) {
        console.warn('Service discovery failed:', e);
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

async function disconnect() {
  if (!connectedDevice.value) return;
  try {
    await BleClient.disconnect(connectedDevice.value.deviceId);
  } catch (e) { console.error('Disconnect error:', e); }
  connected.value = false;
  connectedDevice.value = undefined;
  clearConnectionTarget();
  pairing.value = false;
  statusMessage.value = 'Disconnected';
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
        log(`ERROR ${toHex(frame)} ${err?.message ?? err}`);
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
      try {
        const dv = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        await BleClient.writeWithoutResponse(targetDeviceId, targetServiceUuid, targetCharUuid, dv);
        return;
      } catch (e2) { lastError = e2; }

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
function sendOutputFrames(): number {
  if (!connected.value || !targetDeviceId) {
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
  enqueueHexFrames(validFrames);
  statusMessage.value = `Queued ${validFrames.length} frame(s) for BLE send`;
  return validFrames.length;
}

function getDeviceName(device: DeviceLike): string {
  return device.name || device.deviceId.substring(0, 8) + '…';
}

/* ================================================================== */
/*  Composable (returns singleton state)                               */
/* ================================================================== */
export function useBle() {
  return {
    isNative:        readonly(isNative),
    bleInitialized:  readonly(bleInitialized),
    scanning:        readonly(scanning),
    connected:       readonly(connected),
    devices:         readonly(devices),
    connectedDevice: readonly(connectedDevice),
    statusMessage,
    eventsLog:       readonly(eventsLog),
    sending:         readonly(sending),
    pairing:         readonly(pairing),
    bondedDevices:   readonly(bondedDevices),

    initialize,
    startScan,
    startAutoScan,
    cancelScan,
    stopScan,
    connectToDevice,
    disconnect,
    sendOutputFrames,
    getDeviceName,
  };
}
