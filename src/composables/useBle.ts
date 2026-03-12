import { ref, readonly } from 'vue';
import { Capacitor } from '@capacitor/core';
import { BleClient, type BleDevice, type ScanResult } from '@capacitor-community/bluetooth-le';

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
const SCAN_TIMEOUT_MS = 5000;
const FLUSH_INTERVAL_MS = 1000;
const INTER_FRAME_DELAY_MS = 50;
const INTER_CHUNK_DELAY_MS = 10;

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
const connectedDevice = ref<BleDevice | undefined>(undefined);
const statusMessage = ref('');
const eventsLog = ref<string[]>([]);
const sending = ref(false);

let pending: Uint8Array[] = [];
let flushing = false;
let flushTimer: ReturnType<typeof setInterval> | undefined;
let scanTimeoutId: ReturnType<typeof setTimeout> | undefined;
let initialized = false;

let targetDeviceId: string | undefined;
let targetServiceUuid: string | undefined;
let targetCharUuid: string | undefined;

/* ---- log helper ---- */
function log(msg: string) {
  const ts = new Date().toLocaleTimeString();
  eventsLog.value.unshift(`${ts} ${msg}`);
  if (eventsLog.value.length > 50) eventsLog.value.pop();
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
  }
}

async function stopScan() {
  if (!scanning.value) return;
  try { await BleClient.stopLEScan(); } catch {}
  scanning.value = false;
  statusMessage.value = `Found ${devices.value.length} device(s)`;
}

/* ================================================================== */
/*  Connect / Disconnect                                               */
/* ================================================================== */
async function connectToDevice(device: BleDevice) {
  statusMessage.value = `Connecting to ${device.name || device.deviceId}…`;
  try {
    await BleClient.connect(device.deviceId, () => {
      connected.value = false;
      connectedDevice.value = undefined;
      targetDeviceId = undefined;
      statusMessage.value = 'Device disconnected';
    });

    connected.value = true;
    connectedDevice.value = device;
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
  } catch (e: any) {
    statusMessage.value = 'Connection failed: ' + (e?.message ?? e);
  }
}

async function disconnect() {
  if (!connectedDevice.value) return;
  try {
    await BleClient.disconnect(connectedDevice.value.deviceId);
  } catch (e) { console.error('Disconnect error:', e); }
  connected.value = false;
  connectedDevice.value = undefined;
  targetDeviceId = undefined;
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

function getDeviceName(device: BleDevice): string {
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

    initialize,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    sendOutputFrames,
    getDeviceName,
  };
}
