import type { App } from 'vue';

export type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DiagnosticLogEntry {
  timestamp: string;
  level: DiagnosticLogLevel;
  scope: string;
  message: string;
  context?: unknown;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DIAGNOSTIC_LOG_STORAGE_KEY = 'easycodec.diagnosticLogs.v1';
export const MAX_DIAGNOSTIC_LOG_ENTRIES = 600;

const SECRET_FIELD_PATTERN = /^(?:password|secret|token|key|keyHex|apiKey|authToken|otaAppKey|otaAppKeyHex)$/i;
const entries: DiagnosticLogEntry[] = [];
let persistenceTimer: ReturnType<typeof setTimeout> | undefined;
let globalHandlersInstalled = false;

function getStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function sanitizeDiagnosticValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  try {
    return JSON.parse(JSON.stringify(value, (key, nestedValue) => {
      if (SECRET_FIELD_PATTERN.test(key)) return '[REDACTED]';
      if (nestedValue instanceof Error) {
        return {
          name: nestedValue.name,
          message: nestedValue.message,
          stack: nestedValue.stack,
          cause: nestedValue.cause,
        };
      }
      if (typeof nestedValue === 'bigint') return nestedValue.toString();
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        if (seen.has(nestedValue)) return '[Circular]';
        seen.add(nestedValue);
      }
      return nestedValue;
    }));
  } catch {
    return String(value);
  }
}

export function formatDiagnosticConsoleMessage(args: unknown[]): string {
  const first = args[0];
  if (typeof first === 'string') return first;
  if (first instanceof Error) return `${first.name}: ${first.message}`;
  if (typeof first === 'object' && first !== null && 'message' in first) {
    const message = (first as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  try {
    return JSON.stringify(sanitizeDiagnosticValue(first)) ?? 'Console message';
  } catch {
    return String(first ?? 'Console message');
  }
}

function isDiagnosticLogEntry(value: unknown): value is DiagnosticLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<DiagnosticLogEntry>;
  return typeof candidate.timestamp === 'string'
    && ['debug', 'info', 'warn', 'error'].includes(candidate.level ?? '')
    && typeof candidate.scope === 'string'
    && typeof candidate.message === 'string';
}

function restorePersistedEntries() {
  const storage = getStorage();
  if (!storage) return;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DIAGNOSTIC_LOG_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return;
    entries.push(...parsed.filter(isDiagnosticLogEntry).slice(-MAX_DIAGNOSTIC_LOG_ENTRIES));
  } catch {
    // A corrupt diagnostic buffer must never prevent the application from starting.
  }
}

function persistEntries() {
  persistenceTimer = undefined;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(DIAGNOSTIC_LOG_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Keep a smaller useful tail if the browser gives this origin a tight quota.
    try {
      storage.setItem(
        DIAGNOSTIC_LOG_STORAGE_KEY,
        JSON.stringify(entries.slice(-Math.min(200, entries.length))),
      );
    } catch {
      // Logging must stay best-effort when storage is unavailable or full.
    }
  }
}

function schedulePersistence(immediate: boolean) {
  if (immediate) {
    if (persistenceTimer) clearTimeout(persistenceTimer);
    persistEntries();
    return;
  }
  if (!persistenceTimer) persistenceTimer = setTimeout(persistEntries, 250);
}

restorePersistedEntries();

export function writeDiagnosticLog(
  level: DiagnosticLogLevel,
  scope: string,
  message: string,
  context?: unknown,
) {
  const entry: DiagnosticLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...(context === undefined ? {} : { context: sanitizeDiagnosticValue(context) }),
  };
  entries.push(entry);
  if (entries.length > MAX_DIAGNOSTIC_LOG_ENTRIES) {
    entries.splice(0, entries.length - MAX_DIAGNOSTIC_LOG_ENTRIES);
  }
  schedulePersistence(level === 'warn' || level === 'error');
}

export function createDiagnosticLogger(scope: string) {
  return {
    debug: (message: string, context?: unknown) => writeDiagnosticLog('debug', scope, message, context),
    info: (message: string, context?: unknown) => writeDiagnosticLog('info', scope, message, context),
    warn: (message: string, context?: unknown) => writeDiagnosticLog('warn', scope, message, context),
    error: (message: string, context?: unknown) => writeDiagnosticLog('error', scope, message, context),
  };
}

export function getDiagnosticLogs(): DiagnosticLogEntry[] {
  return entries.map(entry => ({ ...entry }));
}

export function clearDiagnosticLogs() {
  entries.length = 0;
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = undefined;
  try {
    getStorage()?.removeItem(DIAGNOSTIC_LOG_STORAGE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}

export function installGlobalDiagnosticHandlers(app: App) {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;
  const logger = createDiagnosticLogger('application');
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    writeDiagnosticLog('warn', 'console', formatDiagnosticConsoleMessage(args), { arguments: args });
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    writeDiagnosticLog('error', 'console', formatDiagnosticConsoleMessage(args), { arguments: args });
    originalError(...args);
  };

  app.config.errorHandler = (error, _instance, info) => {
    console.error('Unhandled Vue error', error, info);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('error', event => {
      logger.error('Unhandled window error', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
      });
    });
    window.addEventListener('unhandledrejection', event => {
      logger.error('Unhandled promise rejection', { reason: event.reason });
    });
  }
}
