import Constants from 'expo-constants';
import {
  ESPDevice,
  ESPProvisionManager,
  ESPSecurity,
  ESPTransport,
  ESPWifiAuthMode,
  type ESPWifiList,
} from '@orbital-systems/react-native-esp-idf-provisioning';

/**
 * Force simulated BLE / Wi-Fi provisioning (no native module).
 * Automatically enabled in Expo Go where native provisioning is unavailable.
 */
export const MOCK_PROVISIONING =
  process.env.EXPO_PUBLIC_MOCK_PROVISIONING === 'true' || Constants.appOwnership === 'expo';

const PROVISIONING_TIMEOUT_MS = 45_000;

export type ProvisioningErrorCode =
  | 'WIFI_AUTH_ERROR'
  | 'WIFI_AP_NOT_FOUND'
  | 'PROVISION_TIMEOUT'
  | 'BLE_DISCONNECTED'
  | 'UNKNOWN_ERROR';

export type ProvisioningResult =
  | {
      ok: true;
      deviceId: string;
      ssid: string;
    }
  | {
      ok: false;
      code: ProvisioningErrorCode;
      message: string;
      rawError?: unknown;
    };

export interface ProvisioningScanItem {
  id: string;
  name: string;
  rssi: number;
  transport: 'ble';
}

export interface ProvisionDeviceParams {
  deviceName: string;
  pop: string;
  ssid: string;
  password: string;
}

export function parseDeviceIdFromProvisionName(deviceName: string): string {
  const n = deviceName.trim();
  if (n.startsWith('PROV_')) return n.slice('PROV_'.length);
  return n;
}

/**
 * BLE advert name for ESP-IDF `ESPDevice`. Prefer the value saved at provisioning; otherwise
 * prefix app `deviceId` (the id after stripping `PROV_` from the broadcast name).
 */
export function resolveBleProvisionAdvertName(deviceId: string, savedAdvertName?: string | null): string {
  const saved = savedAdvertName?.trim();
  if (saved && saved.startsWith('PROV_')) return saved;
  const id = deviceId.trim();
  if (id.startsWith('PROV_')) return id;
  return `PROV_${id}`;
}

function extractErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.code === 'string' || typeof o.code === 'number') return String(o.code);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Native layer reports this when no BLE peripheral matches the provisioning name (device off,
 * out of range, not in provisioning mode, or wrong `PROV_*` name).
 */
export function isBleProvisioningDeviceNotFound(error: unknown): boolean {
  const text = extractErrorText(error).toLowerCase();
  return (
    text.includes('no bluetooth device found') ||
    (text.includes('bluetooth') && text.includes('prefix') && (text.includes('not found') || text.includes('no device')))
  );
}

/**
 * Map native / JS errors into structured provisioning failure codes for UI routing.
 */
export function normalizeProvisioningError(error: unknown): Extract<ProvisioningResult, { ok: false }> {
  const rawError = error;
  const text = extractErrorText(error);
  const m = text.toLowerCase();

  const isAuth =
    /\bauth_failed\b/i.test(text) ||
    /\bauth_error\b/i.test(text) ||
    /\bwifi_auth_error\b/i.test(text) ||
    m.includes('wrong password') ||
    m.includes('authentication failed') ||
    (m.includes('authenticat') && m.includes('fail')) ||
    m.includes('psk') ||
    (m.includes('password') && (m.includes('invalid') || m.includes('wrong') || m.includes('fail'))) ||
    m.includes('4-way') ||
    m.includes('handshake') ||
    /** ESP-IDF / Android bridge often surfaces wrong PSK (or bad status) as this phrase. */
    /\bprovisioning failed\b/i.test(text);

  if (isAuth) {
    const friendly = /\bprovisioning failed\b/i.test(text)
      ? 'Wi-Fi password was not accepted (check the password and try again).'
      : text;
    return { ok: false, code: 'WIFI_AUTH_ERROR', message: friendly, rawError };
  }

  const isAp =
    /\bap_not_found\b/i.test(text) ||
    /\bwifi_ap_not_found\b/i.test(text) ||
    m.includes('network not found') ||
    m.includes('no ap') ||
    m.includes('ssid not found') ||
    (m.includes('not found') && m.includes('wifi'));

  if (isAp) {
    return { ok: false, code: 'WIFI_AP_NOT_FOUND', message: text, rawError };
  }

  const isTimeout =
    /\bprovision_timeout\b/i.test(text) ||
    m.includes('timeout') ||
    m.includes('timed out');

  if (isTimeout) {
    const bare =
      /^provision_timeout$/i.test(text.trim()) ||
      text.trim() === 'PROVISION_TIMEOUT' ||
      text.trim() === 'Error: PROVISION_TIMEOUT';
    return {
      ok: false,
      code: 'PROVISION_TIMEOUT',
      message: bare
        ? 'The device did not finish joining Wi‑Fi in time. Move closer to the router or device, wait a few seconds, and try again.'
        : text,
      rawError,
    };
  }

  const isBle =
    m.includes('disconnected') ||
    m.includes('ble disconnected') ||
    (m.includes('gatt') && m.includes('disconnect')) ||
    m.includes('connection closed') ||
    m.includes('device disconnected');

  if (isBle) {
    return { ok: false, code: 'BLE_DISCONNECTED', message: text, rawError };
  }

  return { ok: false, code: 'UNKNOWN_ERROR', message: text, rawError };
}

function isProvisionStatusOk(status: string | undefined): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  return s.includes('success') || s === 'true' || s === '1' || s === 'ok';
}

/**
 * Race `promise` against a timer. If the timer wins, absorb late settle/reject from `promise`
 * so the native stack does not surface as an extra unhandled rejection after timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimer();
      void promise.catch(() => undefined);
      reject(new Error('PROVISION_TIMEOUT'));
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimer();
        resolve(value);
      },
      (reason) => {
        if (settled) return;
        settled = true;
        clearTimer();
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      },
    );
  });
}

export interface ProvisionCallbacks {
  onPhase?: (phase: 'connectingDevice' | 'sendingCredentials' | 'waitingForWifi') => void;
}

export async function scanProvisioningDevices(prefix = 'PROV_'): Promise<ProvisioningScanItem[]> {
  if (MOCK_PROVISIONING) {
    console.log('[AquaNode][ESP] MOCK_PROVISIONING=true — returning fake scan results');
    await new Promise((r) => setTimeout(r, 400));
    return [
      { id: 'mock-ble-1', name: 'PROV_WQM_MOCK01', rssi: -55, transport: 'ble' },
      { id: 'mock-ble-2', name: 'PROV_WQM_MOCK02', rssi: -72, transport: 'ble' },
    ];
  }

  try {
    console.log('[AquaNode][ESP] searchESPDevices start', { prefix, transport: 'ble', security: 'secure(1)' });
    const devices = await ESPProvisionManager.searchESPDevices(prefix, ESPTransport.ble, ESPSecurity.secure);
    console.log('[AquaNode][ESP] searchESPDevices success, raw count:', devices?.length ?? 0);
    return devices.map((d, index) => {
      const rssi = typeof (d as unknown as { rssi?: number }).rssi === 'number' ? (d as unknown as { rssi: number }).rssi : -70;
      return {
        id: `${d.name}-${index}`,
        name: d.name,
        rssi,
        transport: 'ble' as const,
      };
    });
  } catch (e) {
    if (isBleProvisioningDeviceNotFound(e)) {
      console.log('[AquaNode][ESP] searchESPDevices: no devices match prefix (treated as empty list)');
      return [];
    }
    console.error('[AquaNode][ESP] searchESPDevices FAILED:', e);
    if (e instanceof Error) {
      console.error('[AquaNode][ESP] message:', e.message);
      if (e.stack) console.error('[AquaNode][ESP] stack:', e.stack);
    }
    throw e;
  }
}

export function stopScan(): void {
  if (MOCK_PROVISIONING) return;
  try {
    ESPProvisionManager.stopESPDevicesSearch();
  } catch {
    /* noop */
  }
}

export async function provisionDevice(
  params: ProvisionDeviceParams,
  callbacks?: ProvisionCallbacks,
): Promise<ProvisioningResult> {
  const { deviceName, pop, ssid, password } = params;
  const pwdTrim = password.trim();
  const pwdLower = pwdTrim.toLowerCase();

  if (MOCK_PROVISIONING) {
    callbacks?.onPhase?.('connectingDevice');
    await new Promise((r) => setTimeout(r, 400));
    callbacks?.onPhase?.('sendingCredentials');
    await new Promise((r) => setTimeout(r, 400));
    if (pwdLower === 'wrong' || pwdLower === '1234') {
      callbacks?.onPhase?.('waitingForWifi');
      await new Promise((r) => setTimeout(r, 500));
      return normalizeProvisioningError(new Error('AUTH_FAILED Wrong Wi-Fi password'));
    }
    callbacks?.onPhase?.('waitingForWifi');
    await new Promise((r) => setTimeout(r, 2200));
    return {
      ok: true,
      deviceId: parseDeviceIdFromProvisionName(deviceName),
      ssid,
    };
  }

  const device = new ESPDevice({
    name: deviceName,
    transport: ESPTransport.ble,
    security: ESPSecurity.secure,
  });

  const safeDisconnect = () => {
    try {
      device.disconnect();
    } catch {
      /* noop */
    }
  };

  try {
    type Inner = { kind: 'ok' } | { kind: 'bad'; status: string };
    const inner = await withTimeout(
      (async (): Promise<Inner> => {
        callbacks?.onPhase?.('connectingDevice');
        await device.connect(pop, null, null);
        callbacks?.onPhase?.('sendingCredentials');
        callbacks?.onPhase?.('waitingForWifi');
        const statusResponse = await device.provision(ssid, pwdTrim);
        if (!isProvisionStatusOk(statusResponse?.status)) {
          return { kind: 'bad', status: String(statusResponse?.status ?? 'Provisioning failed') };
        }
        return { kind: 'ok' };
      })(),
      PROVISIONING_TIMEOUT_MS,
    );

    if (inner.kind === 'bad') {
      safeDisconnect();
      return normalizeProvisioningError(inner.status);
    }
  } catch (e) {
    const normalized = normalizeProvisioningError(e);
    if (normalized.code === 'WIFI_AUTH_ERROR') {
      console.log('[AquaNode][ESP] provision failed: Wi-Fi authentication (likely wrong password)');
    } else if (
      normalized.code === 'PROVISION_TIMEOUT' ||
      normalized.code === 'BLE_DISCONNECTED' ||
      normalized.code === 'WIFI_AP_NOT_FOUND'
    ) {
      console.warn('[AquaNode][ESP] provision finished without success:', normalized.code, normalized.message);
    } else {
      console.error('[AquaNode][ESP] provision flow failed:', e);
      if (e instanceof Error && e.stack) console.error('[AquaNode][ESP] stack:', e.stack);
    }
    safeDisconnect();
    return normalized;
  }

  safeDisconnect();

  return {
    ok: true,
    deviceId: parseDeviceIdFromProvisionName(deviceName),
    ssid,
  };
}

/** Keep strongest RSSI when the firmware returns duplicate SSIDs. */
export function dedupeWifiBySsidPreferStrongest(networks: ESPWifiList[]): ESPWifiList[] {
  const best = new Map<string, ESPWifiList>();
  for (const n of networks) {
    const key = n.ssid;
    const prev = best.get(key);
    if (!prev || n.rssi > prev.rssi) best.set(key, n);
  }
  return Array.from(best.values()).sort((a, b) => b.rssi - a.rssi);
}

export async function scanWifiNetworksForDevice(deviceName: string, pop: string): Promise<ESPWifiList[]> {
  if (MOCK_PROVISIONING) {
    await new Promise((r) => setTimeout(r, 500));
    return dedupeWifiBySsidPreferStrongest([
      { ssid: 'Home_2.4G', rssi: -48, auth: ESPWifiAuthMode.wpaWpa2Psk },
      { ssid: 'Farm_Office', rssi: -62, auth: ESPWifiAuthMode.wpaWpa2Psk },
      { ssid: 'Guest_WiFi', rssi: -71, auth: ESPWifiAuthMode.wpaWpa2Psk },
      { ssid: 'Cafe_Open', rssi: -78, auth: ESPWifiAuthMode.open },
      { ssid: 'Basement_AP', rssi: -86, auth: ESPWifiAuthMode.wpa2Psk },
    ]);
  }
  const device = new ESPDevice({
    name: deviceName,
    transport: ESPTransport.ble,
    security: ESPSecurity.secure,
  });
  try {
    await device.connect(pop, null, null);
    const list = await device.scanWifiList();
    return dedupeWifiBySsidPreferStrongest(list);
  } catch (e) {
    if (isBleProvisioningDeviceNotFound(e)) {
      console.log('[AquaNode][ESP] scanWifiNetworksForDevice: BLE device not found / not advertising', {
        deviceName,
      });
      throw new Error(
        'Could not find this device over Bluetooth. Turn Bluetooth on, put the device in provisioning mode, stay nearby, then tap Refresh. If it was removed from the app, scan for it again from Add device.',
      );
    }
    throw e;
  } finally {
    try {
      device.disconnect();
    } catch {
      /* noop */
    }
  }
}

export async function getDeviceStatusAfterProvision(_deviceId: string): Promise<{ ok: boolean }> {
  return { ok: true };
}
