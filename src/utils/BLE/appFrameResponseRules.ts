import responseRulesJson from '../../../public/config/AppFrameResponseRules.json';

type CorrelationField = 'frameControl' | 'clusterId' | 'attributeId' | 'reportingKind';

export type AppFrameResponseDefinition = {
  cmdId: string;
  timeoutMs: number;
  correlateBy: CorrelationField[];
  errorCorrelateBy?: CorrelationField[];
  statusByteOffset: number;
  successStatus: string;
  errorAttributeIdOffset?: number;
};

type AppFrameRequestMatch = {
  clusterId?: string;
  payloadPrefix?: string;
};

type AppFrameResponseCollection = {
  mode: 'multiple';
  firstResponseTimeoutMs: number;
  idleTimeoutMs: number;
  requestDelay?: {
    byteOffset: number;
    byteLength: number;
    unitMs: number;
    marginMs: number;
  };
};

export type AppFrameResponseRule = {
  name: string;
  requestCmdId: string;
  match?: AppFrameRequestMatch;
  response?: AppFrameResponseDefinition | null;
  collection?: AppFrameResponseCollection;
};

export type CustomAppFrameResponsePolicy =
  | { mode: 'legacy'; firstResponseTimeoutMs: number; idleTimeoutMs: number }
  | { mode: 'none' }
  | { mode: 'single'; firstResponseTimeoutMs: number }
  | { mode: 'multiple'; firstResponseTimeoutMs: number; idleTimeoutMs: number };

type AppFrameResponseRulesFile = {
  version: number;
  fallbackDelayMs: number;
  rules: AppFrameResponseRule[];
};

const responseRules = responseRulesJson as AppFrameResponseRulesFile;

function parseHexByte(value: string): number {
  return Number.parseInt(value, 16);
}

function bytesEqual(
  left: Uint8Array,
  leftOffset: number,
  right: Uint8Array,
  rightOffset: number,
  length: number,
): boolean {
  if (left.length < leftOffset + length || right.length < rightOffset + length) return false;
  for (let index = 0; index < length; index++) {
    if (left[leftOffset + index] !== right[rightOffset + index]) return false;
  }
  return true;
}

function requestAttributeOffset(cmdId: number): number | null {
  if (cmdId === 0x00 || cmdId === 0x02) return 4;
  if (cmdId === 0x06 || cmdId === 0x08) return 5;
  return null;
}

function responseAttributeOffset(cmdId: number): number | null {
  if (cmdId === 0x01) return 4;
  if (cmdId === 0x07 || cmdId === 0x09) return 6;
  return null;
}

export const APP_FRAME_FALLBACK_DELAY_MS = responseRules.fallbackDelayMs;

function frameMatchesRule(frame: Uint8Array, rule: AppFrameResponseRule): boolean {
  if (parseHexByte(rule.requestCmdId) !== frame[1]) return false;
  if (!rule.match) return true;

  if (rule.match.clusterId) {
    const clusterId = Number.parseInt(rule.match.clusterId, 16);
    if (frame.length < 4 || ((frame[2] << 8) | frame[3]) !== clusterId) return false;
  }

  if (rule.match.payloadPrefix) {
    const prefix = rule.match.payloadPrefix.match(/[0-9a-f]{2}/gi)?.map(parseHexByte) ?? [];
    if (prefix.length === 0 || frame.length < 4 + prefix.length) return false;
    if (prefix.some((byte, index) => frame[4 + index] !== byte)) return false;
  }

  return true;
}

export function getAppFrameResponseRule(frame: Uint8Array): AppFrameResponseRule | null {
  if (frame.length < 2) return null;
  return responseRules.rules.find(rule => frameMatchesRule(frame, rule)) ?? null;
}

function readUnsignedBigEndian(frame: Uint8Array, offset: number, length: number): number | null {
  if (length <= 0 || frame.length < offset + length) return null;
  let value = 0;
  for (let index = 0; index < length; index++) value = (value * 256) + frame[offset + index];
  return value;
}

export function getCustomAppFrameResponsePolicy(
  frame: Uint8Array,
): CustomAppFrameResponsePolicy {
  const rule = getAppFrameResponseRule(frame);
  if (!rule) {
    return { mode: 'legacy', firstResponseTimeoutMs: 2000, idleTimeoutMs: 1000 };
  }
  if (rule.collection?.mode === 'multiple') {
    let idleTimeoutMs = rule.collection.idleTimeoutMs;
    const requestDelay = rule.collection.requestDelay;
    if (requestDelay) {
      const delay = readUnsignedBigEndian(
        frame,
        requestDelay.byteOffset,
        requestDelay.byteLength,
      );
      if (delay !== null) {
        idleTimeoutMs = Math.max(
          idleTimeoutMs,
          (delay * requestDelay.unitMs) + requestDelay.marginMs,
        );
      }
    }
    return {
      mode: 'multiple',
      firstResponseTimeoutMs: Math.max(rule.collection.firstResponseTimeoutMs, idleTimeoutMs),
      idleTimeoutMs,
    };
  }
  if (rule.response === null) return { mode: 'none' };
  if (rule.response) {
    return { mode: 'single', firstResponseTimeoutMs: rule.response.timeoutMs };
  }
  return { mode: 'legacy', firstResponseTimeoutMs: 2000, idleTimeoutMs: 1000 };
}

export function matchesAppFrameResponse(request: Uint8Array, response: Uint8Array): boolean {
  const rule = getAppFrameResponseRule(request);
  if (!rule?.response || response.length < 2) return false;
  if (response[1] !== parseHexByte(rule.response.cmdId)) return false;

  const responseStatus = response[rule.response.statusByteOffset];
  const isErrorResponse = responseStatus !== undefined
    && responseStatus !== parseHexByte(rule.response.successStatus);
  const correlateBy = isErrorResponse && rule.response.errorCorrelateBy
    ? rule.response.errorCorrelateBy
    : rule.response.correlateBy;

  for (const field of correlateBy) {
    if (field === 'frameControl' && request[0] !== response[0]) return false;
    if (field === 'clusterId' && !bytesEqual(request, 2, response, 2, 2)) return false;

    if (field === 'attributeId') {
      const requestOffset = requestAttributeOffset(request[1]);
      const responseOffset = responseAttributeOffset(response[1]);
      if (requestOffset === null || responseOffset === null) return false;
      if (!bytesEqual(request, requestOffset, response, responseOffset, 2)) return false;
    }

    if (field === 'reportingKind') {
      if (request.length < 5 || response.length < 6) return false;
      if ((request[4] & 0x01) !== response[5]) return false;
    }
  }

  return true;
}

export function getAppFrameResponseStatus(
  request: Uint8Array,
  response: Uint8Array,
): number | null {
  const definition = getAppFrameResponseRule(request)?.response;
  if (!definition || !matchesAppFrameResponse(request, response)) return null;
  return response[definition.statusByteOffset] ?? null;
}

export function isSuccessfulAppFrameResponse(
  request: Uint8Array,
  response: Uint8Array,
): boolean {
  const definition = getAppFrameResponseRule(request)?.response;
  if (!definition) return false;
  return getAppFrameResponseStatus(request, response) === parseHexByte(definition.successStatus);
}

export function getAppFrameResponseErrorAttributeId(
  request: Uint8Array,
  response: Uint8Array,
): number | null {
  const definition = getAppFrameResponseRule(request)?.response;
  const offset = definition?.errorAttributeIdOffset;
  if (offset === undefined || !matchesAppFrameResponse(request, response)) return null;
  if (response.length < offset + 2) return null;
  return (response[offset] << 8) | response[offset + 1];
}

const APP_FRAME_STATUS_NAMES: Readonly<Record<number, string>> = {
  0x00: 'Success',
  0x7e: 'Not authorized',
  0x80: 'Malformed command',
  0x81: 'Unsupported cluster command',
  0x82: 'Unsupported general command',
  0x85: 'Invalid field',
  0x86: 'Unsupported attribute',
  0x87: 'Invalid value',
  0x88: 'Read only',
  0x89: 'Insufficient space',
  0x8c: 'Unreportable attribute',
  0x8d: 'Invalid data type',
  0x94: 'Timeout',
  0xc0: 'Hardware failure',
  0xc1: 'Software failure',
  0xc2: 'Calibration error',
  0xc3: 'Invalid batch tag size',
};

export function getAppFrameStatusName(status: number): string | null {
  return APP_FRAME_STATUS_NAMES[status] ?? null;
}
