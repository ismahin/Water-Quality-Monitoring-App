import { get, onValue, ref, type DataSnapshot, type Unsubscribe } from 'firebase/database';
import type {
  AquaDevice,
  CalibrationStatus,
  ChildDevice,
  DeviceOnlineStatus,
  GatewayDevice,
  LiveFirebaseDeviceFields,
  RelayDevice,
  SingleDevice,
} from '../../types/device';
import type {
  FirebaseChildLatest,
  FirebaseChildSnapshot,
  FirebaseChildStatus,
  FirebaseDeviceSnapshot,
  FirebaseDeviceStatus,
  FirebaseLatestReading,
  FirebaseNetworkNode,
} from '../../types/firebase';
import {
  deriveUniversalRole,
  normalizeHardwareMode,
  normalizeUniversalRole,
  roleToLegacyDeviceRole,
  type LoRaStatus,
  type UniversalRole,
} from '../../types/universalDevice';
import { getFirebaseDb } from './firebaseClient';

const STALE_MS = 30_000;
const CHILD_STALE_MS = 2 * 60_000;

function isSnapshotStale(receivedAtIso: string, staleMs = STALE_MS): boolean {
  const t = new Date(receivedAtIso).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > staleMs;
}

function numOr(...values: Array<number | undefined | null>): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

function strOr(...values: Array<string | undefined | null>): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return undefined;
}

function boolOr(...values: Array<boolean | undefined | null>): boolean | undefined {
  for (const v of values) {
    if (typeof v === 'boolean') return v;
  }
  return undefined;
}

function childIdFromKey(key: string, node: unknown): string {
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.source_id === 'string') return o.source_id;
    if (typeof o.device_id === 'string') return o.device_id;
  }
  return key;
}

function toChildSnapshot(key: string, snap: DataSnapshot): FirebaseChildSnapshot {
  const raw = snap.val() as Record<string, unknown> | null;
  const receivedAt = new Date().toISOString();
  if (!raw || typeof raw !== 'object') return { latest: null, status: null, receivedAt };

  const nestedLatest = raw.latest && typeof raw.latest === 'object' ? (raw.latest as FirebaseChildLatest) : null;
  const nestedStatus = raw.status && typeof raw.status === 'object' ? (raw.status as FirebaseChildStatus) : null;
  const nestedNetwork = raw.network && typeof raw.network === 'object' ? (raw.network as FirebaseNetworkNode) : null;

  if (nestedLatest || nestedStatus || nestedNetwork) {
    return {
      latest: nestedLatest,
      status: nestedStatus,
      network: nestedNetwork,
      receivedAt,
    };
  }

  const sourceId = childIdFromKey(key, raw);
  return {
    latest: { source_id: sourceId, ...(raw as FirebaseChildLatest) },
    status: null,
    receivedAt,
  };
}

function latestUploadIso(latest?: { last_upload_ms?: number } | null, status?: { last_upload_ms?: number } | null): string | undefined {
  const ms = numOr(status?.last_upload_ms, latest?.last_upload_ms);
  if (!ms) return undefined;
  return new Date(ms < 10_000_000_000 ? Date.now() : ms).toISOString();
}

export function calculateOnlineStatus(
  statusOnline: boolean | undefined,
  receivedAtIso: string,
  staleMs = STALE_MS,
): DeviceOnlineStatus {
  const stale = isSnapshotStale(receivedAtIso, staleMs);
  if (statusOnline === false) return 'offline';
  if (statusOnline === true && !stale) return 'online';
  if (statusOnline === true && stale) return 'warning';
  return stale ? 'warning' : 'online';
}

export function normalizeDeviceRole(
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
): UniversalRole {
  return deriveUniversalRole({
    role: status?.role ?? latest?.role,
    hardwareMode: status?.hardware_mode ?? latest?.hardware_mode,
    gatewayUplinkEnabled: status?.gateway_uplink_enabled ?? latest?.gateway_uplink_enabled,
    relayEnabled: status?.relay_enabled ?? latest?.relay_enabled,
    loraReady: status?.lora_ready ?? latest?.lora_ready,
  });
}

export function isGatewayMode(
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
): boolean {
  return normalizeDeviceRole(latest, status) === 'GATEWAY';
}

export type LoraAggregateStatus = LoRaStatus;

export function getLoraStatus(latest: FirebaseLatestReading | null, status: FirebaseDeviceStatus | null): LoraAggregateStatus {
  const hardwareMode = normalizeHardwareMode(status?.hardware_mode ?? latest?.hardware_mode);
  if (hardwareMode === 'SINGLE') return 'disabled';

  const enabled = boolOr(status?.lora_enabled, latest?.lora_enabled);
  if (enabled === false) return 'disabled';

  const ready = boolOr(status?.lora_ready, latest?.lora_ready, status?.lora_gateway_ready, latest?.lora_gateway_ready);
  const error = strOr(status?.lora_error, latest?.lora_error, status?.lora_last_error, latest?.lora_last_error);
  if (ready === true) return 'ready';
  if (ready === false || (error && error !== 'none')) return 'error';
  return 'unknown';
}

export function getWifiConnected(status: FirebaseDeviceStatus | null, _latest: FirebaseLatestReading | null): boolean {
  return status?.wifi_connected === true;
}

function buildOwnLiveFields(
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
  receivedAt: string,
): LiveFirebaseDeviceFields {
  const universalRole = normalizeDeviceRole(latest, status);
  const loraStatus = getLoraStatus(latest, status);
  const statusSaysOnline = status?.online === true;
  const hardwareMode = normalizeHardwareMode(status?.hardware_mode ?? latest?.hardware_mode);

  return {
    firebaseRole: universalRole,
    universalRole,
    hardwareMode: hardwareMode ?? strOr(status?.hardware_mode?.toString(), latest?.hardware_mode?.toString()),
    networkId: strOr(status?.network_id, latest?.network_id),
    parentId: strOr(status?.parent_id, latest?.parent_id),
    rootGatewayId: strOr(status?.root_gateway_id, latest?.root_gateway_id),
    gatewayUplinkEnabled: boolOr(status?.gateway_uplink_enabled, latest?.gateway_uplink_enabled),
    relayEnabled: boolOr(status?.relay_enabled, latest?.relay_enabled),
    ip: strOr(status?.ip, latest?.ip),
    wifiConnected: getWifiConnected(status, latest),
    sensorMode: status?.sensor_mode,
    commandStream: status?.command_stream,
    removeRequested: status?.remove_requested === true,
    reprovisionRequired: status?.reprovision_required === true,
    firebaseMessage: typeof status?.message === 'string' ? status.message : undefined,
    loraEnabled: loraStatus !== 'disabled',
    loraStatus,
    loraReady: loraStatus === 'ready',
    loraInitialized: boolOr(status?.lora_initialized, latest?.lora_initialized),
    loraGatewayReady: boolOr(status?.lora_ready, latest?.lora_ready, status?.lora_gateway_ready, latest?.lora_gateway_ready),
    loraFrequencyMhz: numOr(status?.lora_frequency_mhz, latest?.lora_frequency_mhz),
    loraLastError: strOr(status?.lora_error, latest?.lora_error, status?.lora_last_error, latest?.lora_last_error),
    loraPacketCount: numOr(status?.lora_packet_count, latest?.lora_packet_count),
    lastLoraRssi: numOr(status?.last_lora_rssi, latest?.last_lora_rssi),
    lastLoraSnr: numOr(status?.last_lora_snr, latest?.last_lora_snr),
    lastLoraPayload: status?.last_lora_payload,
    forwardQueue: status?.forward_queue,
    bleConfigConnected: status?.ble_config_connected,
    telemetryStale: statusSaysOnline && isSnapshotStale(receivedAt),
    sensorStatus: typeof latest?.sensor_status === 'string' ? latest.sensor_status : undefined,
    firebaseCalibrationStatus:
      typeof latest?.calibration_status === 'string' ? latest.calibration_status : undefined,
    isLive: true,
    isDemo: false,
  };
}

function baseCalibrationStatus(_latest?: { calibration_status?: string } | null): CalibrationStatus {
  return 'ok';
}

export function mapFirebaseOwnDeviceToAppDevice(
  deviceId: string,
  latest: FirebaseLatestReading | null,
  status: FirebaseDeviceStatus | null,
  receivedAt: string,
  cloudOnline = true,
  displayName?: string,
): AquaDevice {
  const id = strOr(latest?.device_id, status?.device_id, deviceId) ?? deviceId;
  const universalRole = normalizeDeviceRole(latest, status);
  const legacyRole = roleToLegacyDeviceRole(universalRole);
  const name = displayName ?? id;
  const online = calculateOnlineStatus(status?.online, receivedAt);
  const loraStatus = getLoraStatus(latest, status);

  const common = {
    id,
    name,
    pondId: 'pond-a',
    online,
    batteryPercent: numOr(latest?.battery) ?? 0,
    lastSeenAt: receivedAt,
    lastDataAt: receivedAt,
    sensors: {
      ph: numOr(latest?.ph) ?? 0,
      tdsPpm: numOr(latest?.tds) ?? 0,
      temperatureC: numOr(latest?.temperature) ?? 0,
      turbidityNtu: numOr(latest?.turbidity) ?? 0,
    },
    calibrationStatus: baseCalibrationStatus(latest),
    firmwareVersion: '1.0.0',
    universalRole,
    isLive: true,
    isDemo: false,
    ...buildOwnLiveFields(latest, status, receivedAt),
  };

  if (legacyRole === 'gateway') {
    return {
      ...common,
      role: 'gateway',
      wifiSsid: strOr(status?.wifi_ssid, latest?.wifi_ssid) ?? '-',
      wifiRssi: numOr(status?.wifi_rssi, latest?.wifi_rssi) ?? -100,
      cloudOnline,
      loraGatewayEnabled: loraStatus === 'ready',
      childDeviceIds: [],
    } satisfies GatewayDevice;
  }

  if (legacyRole === 'relay') {
    const parentId = strOr(status?.parent_id, latest?.parent_id) ?? '';
    return {
      ...common,
      role: 'relay',
      parentId,
      loraRssi: numOr(status?.last_lora_rssi, latest?.last_lora_rssi) ?? -120,
      loraSnr: numOr(status?.last_lora_snr, latest?.last_lora_snr) ?? 0,
      packetSuccessPercent: loraStatus === 'ready' ? 100 : 0,
      childDeviceIds: [],
    } satisfies RelayDevice;
  }

  if (legacyRole === 'child') {
    const parentId = strOr(status?.parent_id, latest?.parent_id) ?? '';
    return {
      ...common,
      role: 'child',
      parentId,
      loraRssi: numOr(status?.last_lora_rssi, latest?.last_lora_rssi) ?? -120,
      loraSnr: numOr(status?.last_lora_snr, latest?.last_lora_snr) ?? 0,
      packetSuccessPercent: loraStatus === 'ready' ? 100 : 0,
    } satisfies ChildDevice;
  }

  return {
    ...common,
    role: 'single',
    wifiSsid: strOr(status?.wifi_ssid, latest?.wifi_ssid) ?? '-',
    wifiRssi: numOr(status?.wifi_rssi, latest?.wifi_rssi) ?? -100,
    cloudOnline,
  } satisfies SingleDevice;
}

export function mapFirebaseChildToAppDevice(
  gatewayId: string,
  sourceId: string,
  latest: FirebaseChildLatest | null,
  status: FirebaseChildStatus | null,
  network: FirebaseNetworkNode | null | undefined,
  receivedAt: string,
  displayName?: string,
): ChildDevice | RelayDevice {
  const id = strOr(latest?.source_id, status?.source_id, status?.device_id, network?.source_id, network?.device_id, sourceId) ?? sourceId;
  const role = deriveUniversalRole({
    role: status?.role ?? latest?.role ?? network?.role,
    hardwareMode: 'NETWORK',
    relayEnabled: status?.relay_enabled ?? latest?.relay_enabled ?? network?.relay_enabled,
    gatewayUplinkEnabled: false,
    loraReady: status?.lora_ready ?? network?.lora_ready,
  });
  const legacyRole = role === 'RELAY' ? 'relay' : 'child';
  const parentFromRoute = strOr(status?.parent_id, latest?.parent_id, network?.parent_id, status?.forwarded_by, latest?.forwarded_by, network?.forwarded_by);
  const route = strOr(status?.route, latest?.route, network?.route);
  const parentId = parentFromRoute ?? (route ? route.split('>').slice(1, 2)[0] : gatewayId) ?? gatewayId;
  const lastSeen = latestUploadIso(latest, status) ?? receivedAt;
  const online = calculateOnlineStatus(status?.online, lastSeen, CHILD_STALE_MS);
  const common = {
    id,
    name: displayName ?? id,
    role: legacyRole,
    pondId: 'pond-a',
    parentId,
    online,
    batteryPercent: numOr(latest?.battery, network?.battery) ?? 0,
    lastSeenAt: lastSeen,
    lastDataAt: lastSeen,
    sensors: {
      ph: numOr(latest?.ph) ?? 0,
      tdsPpm: numOr(latest?.tds) ?? 0,
      temperatureC: numOr(latest?.temperature) ?? 0,
      turbidityNtu: numOr(latest?.turbidity) ?? 0,
    },
    calibrationStatus: 'ok' as const,
    firmwareVersion: '1.0.0',
    universalRole: (legacyRole === 'relay' ? 'RELAY' : 'CHILD') as UniversalRole,
    hardwareMode: 'NETWORK',
    networkId: strOr(status?.network_id, latest?.network_id, network?.network_id),
    rootGatewayId: strOr(status?.root_gateway_id, latest?.root_gateway_id, network?.root_gateway_id, gatewayId),
    gatewayId,
    sourceId: id,
    route,
    forwardedBy: strOr(status?.forwarded_by, latest?.forwarded_by, network?.forwarded_by),
    relayEnabled: legacyRole === 'relay',
    gatewayUplinkEnabled: false,
    loraStatus: (status?.lora_ready === false || network?.lora_ready === false ? 'error' : 'ready') as LoRaStatus,
    loraReady: status?.lora_ready ?? network?.lora_ready,
    loraLastError: strOr(status?.lora_error, network?.lora_error),
    childRssi: numOr(status?.child_rssi, latest?.child_rssi, network?.child_rssi),
    childSnr: numOr(status?.child_snr, latest?.child_snr, network?.child_snr),
    gatewayRssi: numOr(status?.gateway_rssi, latest?.gateway_rssi, network?.gateway_rssi),
    gatewaySnr: numOr(status?.gateway_snr, latest?.gateway_snr, network?.gateway_snr),
    isLive: true,
    isDemo: false,
  };

  if (legacyRole === 'relay') {
    return {
      ...common,
      role: 'relay',
      loraRssi: numOr(common.childRssi, common.gatewayRssi) ?? -120,
      loraSnr: numOr(common.childSnr, common.gatewaySnr) ?? 0,
      packetSuccessPercent: latest ? 100 : 0,
      childDeviceIds: [],
    } satisfies RelayDevice;
  }

  return {
    ...common,
    role: 'child',
    loraRssi: numOr(common.childRssi, common.gatewayRssi) ?? -120,
    loraSnr: numOr(common.childSnr, common.gatewaySnr) ?? 0,
    packetSuccessPercent: latest ? 100 : 0,
  } satisfies ChildDevice;
}

export const mapFirebaseDeviceToAquaDevice = mapFirebaseOwnDeviceToAppDevice;

export function subscribeToDeviceLatest(
  deviceId: string,
  callback: (value: FirebaseLatestReading | null, receivedAt: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(ref(db, `devices/${deviceId}/latest`), (snap) => {
    callback(snap.val() as FirebaseLatestReading | null, new Date().toISOString());
  });
}

export function subscribeToDeviceStatus(
  deviceId: string,
  callback: (value: FirebaseDeviceStatus | null, receivedAt: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(ref(db, `devices/${deviceId}/status`), (snap) => {
    callback(snap.val() as FirebaseDeviceStatus | null, new Date().toISOString());
  });
}

export function subscribeToDevice(deviceId: string, callback: (snapshot: FirebaseDeviceSnapshot) => void): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};

  let latest: FirebaseLatestReading | null = null;
  let status: FirebaseDeviceStatus | null = null;
  let latestReceivedAt = new Date().toISOString();
  let statusReceivedAt = new Date().toISOString();

  const emit = () => {
    const receivedAt =
      new Date(latestReceivedAt).getTime() >= new Date(statusReceivedAt).getTime()
        ? latestReceivedAt
        : statusReceivedAt;
    callback({ latest, status, receivedAt });
  };

  const unsubLatest = onValue(ref(db, `devices/${deviceId}/latest`), (snap) => {
    latest = snap.val() as FirebaseLatestReading | null;
    latestReceivedAt = new Date().toISOString();
    emit();
  });

  const unsubStatus = onValue(ref(db, `devices/${deviceId}/status`), (snap) => {
    status = snap.val() as FirebaseDeviceStatus | null;
    statusReceivedAt = new Date().toISOString();
    emit();
  });

  return () => {
    unsubLatest();
    unsubStatus();
  };
}

export const subscribeToOwnDevice = subscribeToDevice;

export function subscribeToDeviceChildren(
  gatewayId: string,
  callback: (children: Record<string, FirebaseChildSnapshot>) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(ref(db, `devices/${gatewayId}/children`), (snap) => {
    const out: Record<string, FirebaseChildSnapshot> = {};
    snap.forEach((child) => {
      const key = child.key ?? '';
      if (key) out[key] = toChildSnapshot(key, child);
    });
    callback(out);
  });
}

export const subscribeToGatewayChildren = subscribeToDeviceChildren;

export function subscribeToDeviceNetwork(
  gatewayId: string,
  callback: (network: Record<string, FirebaseNetworkNode>) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(ref(db, `devices/${gatewayId}/network`), (snap) => {
    const raw = snap.val() as Record<string, FirebaseNetworkNode> | null;
    callback(raw && typeof raw === 'object' ? raw : {});
  });
}

export const subscribeToGatewayNetwork = subscribeToDeviceNetwork;

export async function getDeviceOnce(deviceId: string): Promise<FirebaseDeviceSnapshot> {
  const db = getFirebaseDb();
  const receivedAt = new Date().toISOString();
  if (!db) return { latest: null, status: null, receivedAt };
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
  return isSnapshotStale(receivedAtIso);
}

export { STALE_MS };
