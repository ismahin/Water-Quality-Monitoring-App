import { get, onValue, ref, type Unsubscribe } from 'firebase/database';
import type { CalibrationStatus, DeviceOnlineStatus, GatewayDevice, LiveFirebaseDeviceFields, SingleDevice } from '../../types/device';
import type {
  FirebaseDeviceSnapshot,
  FirebaseDeviceStatus,
  FirebaseLatestReading,
} from '../../types/firebase';
import { getFirebaseDb } from './firebaseClient';

const STALE_MS = 30_000;

function isProvisionStale(receivedAtIso: string): boolean {
  const t = new Date(receivedAtIso).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > STALE_MS;
}

/** Prefer `status.role`, then `latest.role`, then SINGLE */
export function normalizeDeviceRole(
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
): string {
  const sr = status?.role?.toString().trim().toUpperCase();
  if (sr) return sr;
  const lr = latest?.role?.toString().trim().toUpperCase();
  if (lr) return lr;
  return 'SINGLE';
}

export function isGatewayMode(
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
): boolean {
  const r = normalizeDeviceRole(latest, status);
  const hm = (status?.hardware_mode ?? latest?.hardware_mode)?.toString().trim().toUpperCase();
  return r === 'GATEWAY' || hm === 'GATEWAY';
}

export type LoraAggregateStatus = 'disabled' | 'ready' | 'error' | 'unknown';

export function getLoraStatus(latest: FirebaseLatestReading | null, status: FirebaseDeviceStatus | null): LoraAggregateStatus {
  const enabled = status?.lora_enabled ?? latest?.lora_enabled;
  if (enabled === false) return 'disabled';
  if (enabled !== true) return 'unknown';
  const init = status?.lora_initialized ?? latest?.lora_initialized;
  const ready = status?.lora_gateway_ready ?? latest?.lora_gateway_ready;
  if (init === true && ready === true) return 'ready';
  if (init === false || ready === false) return 'error';
  return 'unknown';
}

export function getWifiConnected(status: FirebaseDeviceStatus | null, _latest: FirebaseLatestReading | null): boolean {
  return status?.wifi_connected === true;
}

function mapOnlineStatus(statusSaysOnline: boolean, stale: boolean): DeviceOnlineStatus {
  if (!statusSaysOnline) return 'offline';
  if (stale) return 'warning';
  return 'online';
}

function numOr(a: number | undefined, b: number | undefined): number | undefined {
  if (typeof a === 'number' && Number.isFinite(a)) return a;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  return undefined;
}

function strOr(a: string | undefined, b: string | undefined): string | undefined {
  if (typeof a === 'string' && a.length > 0) return a;
  if (typeof b === 'string' && b.length > 0) return b;
  return undefined;
}

function boolOr(a: boolean | undefined, b: boolean | undefined): boolean | undefined {
  if (typeof a === 'boolean') return a;
  if (typeof b === 'boolean') return b;
  return undefined;
}

function buildLiveFirebaseFields(
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
  receivedAt: string,
): LiveFirebaseDeviceFields {
  const stale = isProvisionStale(receivedAt);
  const statusSaysOnline = status?.online === true;

  return {
    firebaseRole: normalizeDeviceRole(latest, status),
    hardwareMode: strOr(status?.hardware_mode?.toString(), latest?.hardware_mode?.toString()),
    ip: strOr(status?.ip, latest?.ip),
    wifiConnected: getWifiConnected(status, latest),
    sensorMode: status?.sensor_mode,
    commandStream: status?.command_stream,
    removeRequested: status?.remove_requested === true,
    reprovisionRequired: status?.reprovision_required === true,
    firebaseMessage: typeof status?.message === 'string' ? status.message : undefined,
    loraEnabled: boolOr(status?.lora_enabled, latest?.lora_enabled),
    loraInitialized: boolOr(status?.lora_initialized, latest?.lora_initialized),
    loraGatewayReady: boolOr(status?.lora_gateway_ready, latest?.lora_gateway_ready),
    loraFrequencyMhz: numOr(status?.lora_frequency_mhz, latest?.lora_frequency_mhz),
    loraLastError: strOr(status?.lora_last_error, latest?.lora_last_error),
    loraPacketCount: numOr(status?.lora_packet_count, latest?.lora_packet_count),
    lastLoraRssi: numOr(status?.last_lora_rssi, latest?.last_lora_rssi),
    lastLoraSnr: numOr(status?.last_lora_snr, latest?.last_lora_snr),
    lastLoraPayload: status?.last_lora_payload,
    telemetryStale: statusSaysOnline && stale,
    sensorStatus: typeof latest?.sensor_status === 'string' ? latest.sensor_status : undefined,
    firebaseCalibrationStatus:
      typeof latest?.calibration_status === 'string' ? latest.calibration_status : undefined,
  };
}

export function mapFirebaseDeviceToAquaDevice(
  deviceId: string,
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
  receivedAt: string,
  cloudOnline = true,
): GatewayDevice | SingleDevice {
  const id = latest?.device_id ?? status?.device_id ?? deviceId;
  const last4 = id.length >= 4 ? id.slice(-4) : id;
  const name = latest?.device_id ?? status?.device_id ?? `Device ${last4}`;

  const stale = isProvisionStale(receivedAt);
  const statusSaysOnline = status?.online === true;
  const online = mapOnlineStatus(statusSaysOnline, stale);

  const ph = latest?.ph ?? 0;
  const tdsPpm = latest?.tds ?? 0;
  const temperatureC = latest?.temperature ?? 0;
  const turbidityNtu = latest?.turbidity ?? 0;

  const cal = latest?.calibration_status;
  const calibrationStatus: CalibrationStatus =
    cal === 'MOCK' || cal === undefined || cal === null ? 'ok' : 'ok';

  const wifiSsid = status?.wifi_ssid ?? latest?.wifi_ssid ?? '—';
  const wifiRssi = status?.wifi_rssi ?? latest?.wifi_rssi ?? -100;

  const extras = buildLiveFirebaseFields(latest, status, receivedAt);

  const base = {
    id,
    name,
    pondId: 'pond-a',
    online,
    batteryPercent: latest?.battery ?? 0,
    lastSeenAt: receivedAt,
    lastDataAt: receivedAt,
    sensors: { ph, tdsPpm, temperatureC, turbidityNtu },
    calibrationStatus,
    firmwareVersion: '1.0.0',
    wifiSsid,
    wifiRssi,
    cloudOnline,
    ...extras,
  };

  if (isGatewayMode(latest, status)) {
    const loraSt = getLoraStatus(latest, status);
    const loraGatewayEnabled = loraSt === 'ready';
    return {
      ...base,
      role: 'gateway',
      loraGatewayEnabled,
      childDeviceIds: [],
      // TODO: populate when LoRa child pairing ships
    };
  }

  return {
    ...base,
    role: 'single',
  };
}

export function subscribeToDeviceLatest(
  deviceId: string,
  callback: (value: FirebaseLatestReading | null, receivedAt: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) {
    return () => {};
  }
  const r = ref(db, `devices/${deviceId}/latest`);
  return onValue(r, (snap) => {
    const receivedAt = new Date().toISOString();
    callback(snap.val() as FirebaseLatestReading | null, receivedAt);
  });
}

export function subscribeToDeviceStatus(
  deviceId: string,
  callback: (value: FirebaseDeviceStatus | null, receivedAt: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) {
    return () => {};
  }
  const r = ref(db, `devices/${deviceId}/status`);
  return onValue(r, (snap) => {
    const receivedAt = new Date().toISOString();
    callback(snap.val() as FirebaseDeviceStatus | null, receivedAt);
  });
}

export function subscribeToDevice(deviceId: string, callback: (snapshot: FirebaseDeviceSnapshot) => void): () => void {
  const db = getFirebaseDb();
  if (!db) {
    return () => {};
  }

  let latest: FirebaseLatestReading | null = null;
  let status: FirebaseDeviceStatus | null = null;
  let latestReceivedAt = new Date().toISOString();
  let statusReceivedAt = new Date().toISOString();

  const emit = () => {
    const receivedAt =
      new Date(latestReceivedAt).getTime() >= new Date(statusReceivedAt).getTime()
        ? latestReceivedAt
        : statusReceivedAt;
    callback({
      latest,
      status,
      receivedAt,
    });
  };

  const latestRef = ref(db, `devices/${deviceId}/latest`);
  const statusRef = ref(db, `devices/${deviceId}/status`);

  const unsubLatest = onValue(latestRef, (snap) => {
    latest = snap.val() as FirebaseLatestReading | null;
    latestReceivedAt = new Date().toISOString();
    emit();
  });

  const unsubStatus = onValue(statusRef, (snap) => {
    status = snap.val() as FirebaseDeviceStatus | null;
    statusReceivedAt = new Date().toISOString();
    emit();
  });

  return () => {
    unsubLatest();
    unsubStatus();
  };
}

export async function getDeviceOnce(deviceId: string): Promise<FirebaseDeviceSnapshot> {
  const db = getFirebaseDb();
  const receivedAt = new Date().toISOString();
  if (!db) {
    return { latest: null, status: null, receivedAt };
  }
  const [latestSnap, statusSnap] = await Promise.all([
    get(ref(db, `devices/${deviceId}/latest`)),
    get(ref(db, `devices/${deviceId}/status`)),
  ]);
  return {
    latest: latestSnap.val() as FirebaseLatestReading | null,
    status: statusSnap.val() as FirebaseDeviceStatus | null,
    receivedAt,
  };
}

export function isTelemetryStale(receivedAtIso: string): boolean {
  return isProvisionStale(receivedAtIso);
}

export { STALE_MS };
