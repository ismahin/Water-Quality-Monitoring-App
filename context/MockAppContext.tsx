import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, type Unsubscribe } from 'firebase/database';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AquaAlert } from '../types/alert';
import type { CctvCamera } from '../types/cctv';
import type { AquaDevice, ChildDevice, DeviceOnlineStatus, GatewayDevice, RelayDevice, SingleDevice } from '../types/device';
import type { NetworkDevice, TopologyNode } from '../types/networkDevice';
import type { Pond } from '../types/pond';
import type { SensorThresholds } from '../types/sensor';
import type { FirebaseDeviceSnapshot, FirebaseNetworkNode } from '../types/firebase';
import type { RegisteredDevice, UniversalRole } from '../types/universalDevice';
import { isFirebaseConfigured } from '../constants/env';
import {
  mockAlerts as seedAlerts,
  mockDevices as seedDevices,
  mockPonds as seedPonds,
  mockThresholds as seedThresholds,
  mockUser,
} from '../constants/mockData';
import { getFirebaseDb } from '../services/firebase/firebaseClient';
import {
  childLifecycleLabel,
  mapFirebaseOwnDeviceToAppDevice,
  subscribeToOwnDevice,
  subscribeToGatewayChildrenMerged,
} from '../services/firebase/deviceTelemetryService';
import { subscribeNetworkDevices } from '../services/firebase/deviceService';
import { subscribeTopology } from '../services/firebase/topologyService';
import { DEFAULT_NETWORK_ID } from '../utils/pairingUtils';

const KEYS = {
  onboarded: '@aquanode/hasCompletedOnboarding',
  session: '@aquanode/mockLoggedIn',
  registered: '@aquanode/registeredDevices',
  cctvCameras: '@aquanode/cctvCameras',
};

export type TempUnit = 'C' | 'F';
export type TdsUnit = 'ppm' | 'ec';
export type AppThemePref = 'light' | 'system';

type AddRegisteredOptions = {
  name?: string;
  networkId?: string;
  roleHint?: UniversalRole | string;
  rootGatewayId?: string;
  parentId?: string;
  bleProvisionName?: string;
  bleConfigName?: string;
  pondId?: string;
};

interface MockAppState {
  user: typeof mockUser;
  ponds: Pond[];
  devices: AquaDevice[];
  alerts: AquaAlert[];
  thresholds: SensorThresholds;
  tempUnit: TempUnit;
  tdsUnit: TdsUnit;
  themePref: AppThemePref;
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  mockLoggedIn: boolean;
  hydrated: boolean;
  registeredDevices: RegisteredDevice[];
  cctvCameras: CctvCamera[];
  firebaseRtdbConnected: boolean;
}

interface MockAppContextValue extends MockAppState {
  setHasCompletedOnboarding: (v: boolean) => Promise<void>;
  setMockLoggedIn: (v: boolean) => Promise<void>;
  markAlertResolved: (id: string) => void;
  setThresholds: (t: Partial<SensorThresholds>) => void;
  setTempUnit: (u: TempUnit) => void;
  setTdsUnit: (u: TdsUnit) => void;
  setThemePref: (t: AppThemePref) => void;
  setNotificationsEnabled: (v: boolean) => void;
  addPond: (p: Omit<Pond, 'id'>) => void;
  logout: () => Promise<void>;
  addRegisteredDevice: (deviceId: string, options?: AddRegisteredOptions) => Promise<void>;
  removeRegisteredDevice: (deviceId: string) => Promise<void>;
  updateRegisteredDeviceName: (deviceId: string, name: string) => Promise<void>;
  addCctvCamera: (camera: Omit<CctvCamera, 'id' | 'createdAt'>) => Promise<void>;
  updateCctvCamera: (cameraId: string, camera: Omit<CctvCamera, 'id' | 'createdAt'>) => Promise<void>;
  removeCctvCamera: (cameraId: string) => Promise<void>;
  getLiveDevice: (deviceId: string) => AquaDevice | null;
  getLiveSnapshot: (deviceId: string) => FirebaseDeviceSnapshot | undefined;
  getGatewayChildren: (gatewayId: string) => AquaDevice[];
  getNetworkTree: (gatewayId: string) => AquaDevice[];
  getGatewayNetwork: (gatewayId: string) => Record<string, FirebaseNetworkNode>;
  isRegisteredLiveDevice: (deviceId: string) => boolean;
}

const MockAppContext = createContext<MockAppContextValue | null>(null);

function normalizeRegistered(raw: unknown): RegisteredDevice[] {
  if (!Array.isArray(raw)) return [];
  const out: RegisteredDevice[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const deviceId = typeof o.deviceId === 'string' ? o.deviceId.trim() : '';
    if (!deviceId) continue;
    const legacyRole = typeof o.role === 'string' ? o.role : undefined;
    const roleHint =
      typeof o.roleHint === 'string'
        ? o.roleHint
        : legacyRole === 'gateway'
          ? 'GATEWAY'
          : legacyRole === 'single'
            ? 'SINGLE'
            : undefined;
    out.push({
      deviceId,
      name: typeof o.name === 'string' && o.name.trim() ? o.name : deviceId,
      networkId: typeof o.networkId === 'string' ? o.networkId : '',
      roleHint,
      rootGatewayId: typeof o.rootGatewayId === 'string' ? o.rootGatewayId : undefined,
      parentId: typeof o.parentId === 'string' ? o.parentId : undefined,
      registeredAt:
        typeof o.registeredAt === 'string'
          ? o.registeredAt
          : typeof o.provisionedAt === 'string'
            ? o.provisionedAt
            : new Date().toISOString(),
      provisionedAt: typeof o.provisionedAt === 'string' ? o.provisionedAt : undefined,
      pondId: typeof o.pondId === 'string' ? o.pondId : 'pond-a',
      bleProvisionName: typeof o.bleProvisionName === 'string' ? o.bleProvisionName : undefined,
      bleConfigName: typeof o.bleConfigName === 'string' ? o.bleConfigName : undefined,
    });
  }
  return out;
}

function normalizeCctvCameras(raw: unknown): CctvCamera[] {
  if (!Array.isArray(raw)) return [];
  const out: CctvCamera[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `cctv_${Date.now()}_${out.length}`;
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : `Camera ${out.length + 1}`;
    const streamUrl = typeof o.streamUrl === 'string' ? o.streamUrl.trim() : '';
    if (!streamUrl) continue;
    out.push({
      id,
      name,
      streamUrl,
      location: typeof o.location === 'string' && o.location.trim() ? o.location.trim() : undefined,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

function placeholderDevice(reg: RegisteredDevice, firebaseRtdbConnected: boolean): AquaDevice {
  const roleHint = String(reg.roleHint ?? 'SINGLE').toUpperCase();
  const now = reg.registeredAt || reg.provisionedAt || new Date().toISOString();
  const base = {
    id: reg.deviceId,
    name: reg.name,
    pondId: reg.pondId ?? 'pond-a',
    online: 'offline' as const,
    batteryPercent: 0,
    lastSeenAt: now,
    lastDataAt: now,
    sensors: { ph: 0, tdsPpm: 0, temperatureC: 0, turbidityNtu: 0 },
    calibrationStatus: 'ok' as const,
    firmwareVersion: '1.0.0',
    universalRole: roleHint as UniversalRole,
    hardwareMode: roleHint === 'SINGLE' ? 'SINGLE' : 'NETWORK',
    networkId: reg.networkId,
    parentId: reg.parentId,
    rootGatewayId: reg.rootGatewayId,
    isLive: true,
    isDemo: false,
  };
  if (roleHint === 'GATEWAY') {
    return {
      ...base,
      role: 'gateway',
      wifiSsid: '-',
      wifiRssi: -100,
      cloudOnline: firebaseRtdbConnected,
      loraGatewayEnabled: false,
      gatewayUplinkEnabled: true,
      childDeviceIds: [],
    } satisfies GatewayDevice;
  }
  if (roleHint === 'RELAY') {
    return {
      ...base,
      role: 'relay',
      parentId: reg.parentId ?? '',
      relayEnabled: true,
      loraRssi: -120,
      loraSnr: 0,
      packetSuccessPercent: 0,
      childDeviceIds: [],
    } satisfies RelayDevice;
  }
  if (roleHint === 'CHILD') {
    return {
      ...base,
      role: 'child',
      parentId: reg.parentId ?? '',
      relayEnabled: false,
      loraRssi: -120,
      loraSnr: 0,
      packetSuccessPercent: 0,
    } satisfies ChildDevice;
  }
  return {
    ...base,
    role: 'single',
    wifiSsid: '-',
    wifiRssi: -100,
    cloudOnline: firebaseRtdbConnected,
  } satisfies SingleDevice;
}

function deviceSort(a: AquaDevice, b: AquaDevice): number {
  const order = { gateway: 0, relay: 1, child: 2, single: 3 } as const;
  return order[a.role] - order[b.role] || a.id.localeCompare(b.id);
}

function dateFromMaybeMs(value?: number): string {
  if (!value) return new Date().toISOString();
  const timestamp = value < 10_000_000_000 ? Date.now() - value : value;
  return new Date(timestamp).toISOString();
}

function firstNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((value) => typeof value === 'number' && Number.isFinite(value));
}

function firstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0);
}

function hasNetworkSensorTelemetry(device: NetworkDevice): boolean {
  const latest = device.latest;
  return !!latest && [latest.ph, latest.tds, latest.temperature, latest.turbidity].some((value) => typeof value === 'number' && Number.isFinite(value));
}

function mapNetworkDeviceToAppDevice(device: NetworkDevice, displayName?: string): AquaDevice {
  const latest = device.latest;
  const status = device.status;
  const role = device.displayRole === 'GATEWAY'
    ? 'gateway'
    : device.displayRole === 'RELAY'
      ? 'relay'
      : device.displayRole === 'CHILD' || device.displayRole === 'RELAY_CANDIDATE'
        ? 'child'
        : 'single';
  const parentId = status?.parent_id ?? latest?.parent_id ?? '';
  const rootGatewayId = status?.root_gateway_id ?? latest?.root_gateway_id ?? (role === 'gateway' ? device.id : undefined);
  const telemetryReceived = status?.telemetry_received ?? hasNetworkSensorTelemetry(device);
  const firmwareVersion = firstString(status?.fw, latest?.fw, status?.fw_version, latest?.fw_version, status?.firmware_version, latest?.firmware_version) ?? 'unknown';
  const networkId = status?.network_id ?? latest?.network_id;
  const lifecycleLabel = childLifecycleLabel({
    pairStage: status?.pair_stage,
    lifecycleState: status?.lifecycle_state,
    pairConfirmed: status?.pair_confirmed,
    telemetryReceived,
    latest: latest ? { ph: latest.ph, tds: latest.tds, temperature: latest.temperature, turbidity: latest.turbidity } : null,
  });
  const pendingFirstTelemetry = role !== 'gateway' && role !== 'single' && telemetryReceived !== true && !hasNetworkSensorTelemetry(device);
  const lastSeenAt = dateFromMaybeMs(device.lastSeenMs);
  const online: DeviceOnlineStatus =
    status?.lifecycle_state === 'OFFLINE'
      ? 'offline'
      : status?.lifecycle_state === 'STALE' || pendingFirstTelemetry
        ? 'warning'
        : device.online === true
          ? 'online'
          : device.online === false
            ? 'offline'
            : 'warning';
  const common = {
    id: device.id,
    name: displayName ?? device.id,
    pondId: 'pond-a',
    online,
    batteryPercent: status?.battery ?? latest?.battery ?? 0,
    lastSeenAt,
    lastDataAt: lastSeenAt,
    sensors: {
      ph: latest?.ph ?? 0,
      tdsPpm: latest?.tds ?? 0,
      temperatureC: latest?.temperature ?? 0,
      turbidityNtu: latest?.turbidity ?? 0,
    },
    calibrationStatus: 'ok' as const,
    firmwareVersion,
    universalRole: device.displayRole as UniversalRole,
    hardwareMode: role === 'single' ? 'SINGLE' : 'NETWORK',
    networkId,
    parentId,
    rootGatewayId,
    gatewayId: rootGatewayId,
    route: status?.route ?? latest?.route,
    commandStream: status?.command_stream,
    wifiConnected: status?.wifi_connected ?? latest?.wifi_connected,
    gatewayUplinkEnabled: status?.gateway_uplink_enabled,
    relayEnabled: status?.relay_enabled,
    loraReady: status?.lora_ready ?? latest?.lora_ready,
    loraLastError: status?.lora_error ?? latest?.lora_error,
    loraPacketCount: firstNumber(status?.lora_packet_count, latest?.lora_packet_count, status?.tx_packet_count, latest?.tx_packet_count),
    forwardQueue: firstNumber(status?.forward_queue, status?.forward_queue_size, latest?.forward_queue_size),
    forwardQueueSize: firstNumber(status?.forward_queue_size, status?.forward_queue, latest?.forward_queue_size),
    gatewayUplinkQueueSize: firstNumber(status?.gateway_uplink_queue_size, status?.gateway_uplink_queue, latest?.gateway_uplink_queue_size, latest?.gateway_uplink_queue),
    pairingCloudQueueSize: firstNumber(status?.pairing_cloud_queue_size, status?.pairing_cloud_queue, latest?.pairing_cloud_queue_size, latest?.pairing_cloud_queue),
    offlineFirebaseQueueSize: status?.offline_firebase_queue_size ?? latest?.offline_firebase_queue_size,
    offlineQueueReady: status?.offline_queue_ready ?? latest?.offline_queue_ready,
    pairStage: status?.pair_stage,
    pairConfirmed: status?.pair_confirmed,
    telemetryReceived,
    lifecycleState: status?.lifecycle_state,
    lifecycleLabel,
    pendingFirstTelemetry,
    hasSensorTelemetry: hasNetworkSensorTelemetry(device),
    firebaseMessage: status?.message,
    isLive: true,
    isDemo: false,
  };

  if (role === 'gateway') {
    return {
      ...common,
      role,
      wifiSsid: status?.wifi_ssid ?? latest?.wifi_ssid ?? '-',
      wifiRssi: status?.wifi_rssi ?? latest?.wifi_rssi ?? -100,
      cloudOnline: true,
      loraGatewayEnabled: status?.lora_ready ?? latest?.lora_ready ?? true,
      gatewayUplinkEnabled: status?.gateway_uplink_enabled ?? true,
      childDeviceIds: [],
    } satisfies GatewayDevice;
  }

  if (role === 'relay') {
    return {
      ...common,
      role,
      parentId,
      relayEnabled: true,
      loraRssi: firstNumber(status?.child_rssi, latest?.child_rssi, status?.gateway_rssi, latest?.gateway_rssi, status?.rssi, latest?.rssi) ?? -120,
      loraSnr: firstNumber(status?.child_snr, latest?.child_snr, status?.gateway_snr, latest?.gateway_snr, status?.snr, latest?.snr) ?? 0,
      packetSuccessPercent: latest ? 100 : 0,
      childDeviceIds: [],
    } satisfies RelayDevice;
  }

  if (role === 'child') {
    return {
      ...common,
      role,
      parentId,
      relayEnabled: false,
      loraRssi: firstNumber(status?.child_rssi, latest?.child_rssi, status?.gateway_rssi, latest?.gateway_rssi, status?.rssi, latest?.rssi) ?? -120,
      loraSnr: firstNumber(status?.child_snr, latest?.child_snr, status?.gateway_snr, latest?.gateway_snr, status?.snr, latest?.snr) ?? 0,
      packetSuccessPercent: latest ? 100 : 0,
    } satisfies ChildDevice;
  }

  return {
    ...common,
    role,
    wifiSsid: status?.wifi_ssid ?? latest?.wifi_ssid ?? '-',
    wifiRssi: status?.wifi_rssi ?? latest?.wifi_rssi ?? -100,
    cloudOnline: true,
  } satisfies SingleDevice;
}

function mapTopologyNodeToAppDevice(node: TopologyNode, networkId: string, displayName?: string): AquaDevice {
  const role = node.role === 'GATEWAY'
    ? 'gateway'
    : node.role === 'RELAY'
      ? 'relay'
      : 'child';
  const rootGatewayId = node.root_gateway_id || (role === 'gateway' ? node.device_id : undefined);
  const nodePairStage = typeof node.pair_stage === 'string' ? node.pair_stage : undefined;
  const nodeLifecycleState = typeof node.lifecycle_state === 'string' ? node.lifecycle_state : undefined;
  const nodePairConfirmed = typeof node.pair_confirmed === 'boolean' ? node.pair_confirmed : undefined;
  const telemetryReceived = node.telemetry_received === true;
  const lifecycleLabel = childLifecycleLabel({
    pairStage: nodePairStage,
    lifecycleState: nodeLifecycleState,
    pairConfirmed: nodePairConfirmed,
    telemetryReceived,
    latest: null,
  });
  const pendingFirstTelemetry = role !== 'gateway' && telemetryReceived !== true;
  const lastSeenAt = dateFromMaybeMs(node.last_seen_ms);
  const online: DeviceOnlineStatus =
    nodeLifecycleState === 'OFFLINE'
      ? 'offline'
      : nodeLifecycleState === 'STALE' || pendingFirstTelemetry
        ? 'warning'
        : node.online === true
          ? 'online'
          : node.online === false
            ? 'offline'
            : 'warning';
  const common = {
    id: node.device_id,
    name: displayName ?? node.device_id,
    pondId: 'pond-a',
    online,
    batteryPercent: node.battery ?? 0,
    lastSeenAt,
    lastDataAt: lastSeenAt,
    sensors: { ph: 0, tdsPpm: 0, temperatureC: 0, turbidityNtu: 0 },
    calibrationStatus: 'ok' as const,
    firmwareVersion: '1.0.0',
    universalRole: node.role as UniversalRole,
    hardwareMode: role === 'gateway' ? 'NETWORK' : 'NETWORK',
    networkId,
    parentId: node.parent_id ?? '',
    rootGatewayId,
    gatewayId: rootGatewayId,
    route: node.route,
    pairStage: nodePairStage,
    pairConfirmed: nodePairConfirmed,
    telemetryReceived,
    lifecycleState: nodeLifecycleState,
    lifecycleLabel,
    pendingFirstTelemetry,
    hasSensorTelemetry: false,
    firebaseMessage: typeof node.message === 'string' ? node.message : undefined,
    isLive: true,
    isDemo: false,
  };

  if (role === 'gateway') {
    return {
      ...common,
      role,
      wifiSsid: '-',
      wifiRssi: -100,
      cloudOnline: true,
      loraGatewayEnabled: true,
      gatewayUplinkEnabled: true,
      childDeviceIds: [],
    } satisfies GatewayDevice;
  }

  if (role === 'relay') {
    return {
      ...common,
      role,
      parentId: node.parent_id ?? '',
      relayEnabled: true,
      loraRssi: node.rssi ?? -120,
      loraSnr: node.snr ?? 0,
      packetSuccessPercent: node.last_seen_ms ? 100 : 0,
      childDeviceIds: [],
    } satisfies RelayDevice;
  }

  return {
    ...common,
    role,
    parentId: node.parent_id ?? '',
    relayEnabled: false,
    loraRssi: node.rssi ?? -120,
    loraSnr: node.snr ?? 0,
    packetSuccessPercent: node.last_seen_ms ? 100 : 0,
  } satisfies ChildDevice;
}

function inferGatewayIds(registered: RegisteredDevice[], liveDevices: AquaDevice[]): string[] {
  const ids = new Set<string>();
  for (const reg of registered) {
    const role = String(reg.roleHint ?? '').toUpperCase();
    if (role === 'GATEWAY' || reg.rootGatewayId === reg.deviceId) ids.add(reg.deviceId);
    if (reg.rootGatewayId) ids.add(reg.rootGatewayId);
  }
  for (const device of liveDevices) {
    if (device.role === 'gateway' || device.universalRole === 'GATEWAY') ids.add(device.id);
    if (device.rootGatewayId) ids.add(device.rootGatewayId);
  }
  return Array.from(ids).filter(Boolean);
}

function inferNetworkIds(registered: RegisteredDevice[], liveDevices: AquaDevice[]): string[] {
  const ids = new Set<string>([DEFAULT_NETWORK_ID]);
  for (const reg of registered) {
    if (reg.networkId) ids.add(reg.networkId);
  }
  for (const device of liveDevices) {
    if (device.networkId) ids.add(device.networkId);
  }
  return Array.from(ids).filter(Boolean);
}

function mergeLiveDevices(...groups: AquaDevice[][]): AquaDevice[] {
  const byId = new Map<string, AquaDevice>();
  for (const group of groups) {
    for (const device of group) {
      const existing = byId.get(device.id);
      if (!existing || (existing.role === 'single' && device.role !== 'single')) {
        byId.set(device.id, device);
      }
    }
  }
  return Array.from(byId.values()).sort(deviceSort);
}

export function MockAppProvider({ children }: { children: React.ReactNode }) {
  const [pondsBase, setPonds] = useState<Pond[]>(seedPonds);
  const [alerts, setAlerts] = useState<AquaAlert[]>(seedAlerts);
  const [thresholds, setThresholdsState] = useState<SensorThresholds>(seedThresholds);
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  const [tdsUnit, setTdsUnit] = useState<TdsUnit>('ppm');
  const [themePref, setThemePref] = useState<AppThemePref>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState(false);
  const [mockLoggedIn, setMockLoggedInState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [cctvCameras, setCctvCameras] = useState<CctvCamera[]>([]);
  const [hydratedRegistered, setHydratedRegistered] = useState(false);
  const [liveSnapshots, setLiveSnapshots] = useState<Record<string, FirebaseDeviceSnapshot>>({});
  const [mergedChildrenByGateway, setMergedChildrenByGateway] = useState<Record<string, AquaDevice[]>>({});
  const [networkByGateway, setNetworkByGateway] = useState<Record<string, Record<string, FirebaseNetworkNode>>>({});
  const [sourceDevicesByNetwork, setSourceDevicesByNetwork] = useState<Record<string, NetworkDevice[]>>({});
  const [topologyByNetwork, setTopologyByNetwork] = useState<Record<string, Record<string, TopologyNode>>>({});
  const [firebaseRtdbConnected, setFirebaseRtdbConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, s, regRaw, cctvRaw] = await Promise.all([
          AsyncStorage.getItem(KEYS.onboarded),
          AsyncStorage.getItem(KEYS.session),
          AsyncStorage.getItem(KEYS.registered),
          AsyncStorage.getItem(KEYS.cctvCameras),
        ]);
        if (!cancelled) {
          setHasCompletedOnboardingState(o === '1');
          setMockLoggedInState(s === '1');
          if (regRaw) {
            try {
              setRegisteredDevices(normalizeRegistered(JSON.parse(regRaw)));
            } catch {
              setRegisteredDevices([]);
            }
          }
          if (cctvRaw) {
            try {
              const normalized = normalizeCctvCameras(JSON.parse(cctvRaw));
              console.log('[CCTV Context] hydrated cameras', {
                count: normalized.length,
                cameras: normalized.map((camera) => ({ id: camera.id, name: camera.name, url: camera.streamUrl })),
              });
              setCctvCameras(normalized);
            } catch {
              console.warn('[CCTV Context] failed to parse stored CCTV cameras');
              setCctvCameras([]);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setHydratedRegistered(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRegistered) return;
    void AsyncStorage.setItem(KEYS.registered, JSON.stringify(registeredDevices));
  }, [registeredDevices, hydratedRegistered]);

  useEffect(() => {
    if (!hydratedRegistered) return;
    console.log('[CCTV Context] persist cameras', {
      count: cctvCameras.length,
      cameras: cctvCameras.map((camera) => ({ id: camera.id, name: camera.name, url: camera.streamUrl })),
    });
    void AsyncStorage.setItem(KEYS.cctvCameras, JSON.stringify(cctvCameras));
  }, [cctvCameras, hydratedRegistered]);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !isFirebaseConfigured()) {
      setFirebaseRtdbConnected(false);
      return;
    }
    let unsub: Unsubscribe | undefined;
    try {
      unsub = onValue(ref(db, '.info/connected'), (snap) => setFirebaseRtdbConnected(snap.val() === true));
    } catch {
      setFirebaseRtdbConnected(false);
    }
    return () => {
      unsub?.();
    };
  }, [hydratedRegistered, registeredDevices.length]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !getFirebaseDb()) {
      setLiveSnapshots({});
      return;
    }
    const unsubs = registeredDevices.map((reg) =>
      subscribeToOwnDevice(reg.deviceId, (snap) => {
        setLiveSnapshots((prev) => ({ ...prev, [reg.deviceId]: snap }));
      }, reg.networkId || undefined),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [registeredDevices]);

  const ownLiveDevices = useMemo(() => {
    return registeredDevices.map((reg) => {
      const snap = liveSnapshots[reg.deviceId];
      if (!snap) return placeholderDevice(reg, firebaseRtdbConnected);
      return mapFirebaseOwnDeviceToAppDevice(
        reg.deviceId,
        snap.latest,
        snap.status,
        snap.receivedAt,
        firebaseRtdbConnected,
        reg.name,
      );
    });
  }, [registeredDevices, liveSnapshots, firebaseRtdbConnected]);

  const gatewayIds = useMemo(() => inferGatewayIds(registeredDevices, ownLiveDevices), [registeredDevices, ownLiveDevices]);
  const networkIds = useMemo(() => inferNetworkIds(registeredDevices, ownLiveDevices), [registeredDevices, ownLiveDevices]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !getFirebaseDb()) {
      setSourceDevicesByNetwork({});
      return;
    }
    const unsubs = networkIds.map((networkId) =>
      subscribeNetworkDevices(networkId, (networkDevices) => {
        setSourceDevicesByNetwork((prev) => ({ ...prev, [networkId]: networkDevices }));
      }),
    );
    networkIds.forEach((networkId) => {
      unsubs.push(
        subscribeTopology(networkId, (_tree, flat) => {
          setTopologyByNetwork((prev) => ({ ...prev, [networkId]: flat }));
        }),
      );
    });
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [networkIds]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !getFirebaseDb()) {
      setMergedChildrenByGateway({});
      setNetworkByGateway({});
      return;
    }
    const unsubs: Array<() => void> = [];
    for (const gatewayId of gatewayIds) {
      const gateway = ownLiveDevices.find((device) => device.id === gatewayId || device.rootGatewayId === gatewayId);
      unsubs.push(
        subscribeToGatewayChildrenMerged(
          gateway?.networkId ?? DEFAULT_NETWORK_ID,
          gatewayId,
          (childrenForGateway) => {
            setMergedChildrenByGateway((prev) => ({ ...prev, [gatewayId]: childrenForGateway }));
          },
        ),
      );
    }
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [gatewayIds, ownLiveDevices]);

  const liveChildDevices = useMemo(() => {
    return Object.values(mergedChildrenByGateway).flat().sort(deviceSort);
  }, [mergedChildrenByGateway]);

  const sourceNetworkDevices = useMemo(() => {
    const out: AquaDevice[] = [];
    for (const networkDevices of Object.values(sourceDevicesByNetwork)) {
      for (const device of networkDevices) {
        const reg = registeredDevices.find((r) => r.deviceId === device.id);
        out.push(mapNetworkDeviceToAppDevice(device, reg?.name));
      }
    }
    return out.sort(deviceSort);
  }, [sourceDevicesByNetwork, registeredDevices]);

  const sourceTopologyDevices = useMemo(() => {
    const out: AquaDevice[] = [];
    for (const [networkId, flat] of Object.entries(topologyByNetwork)) {
      for (const node of Object.values(flat)) {
        const reg = registeredDevices.find((r) => r.deviceId === node.device_id);
        out.push(mapTopologyNodeToAppDevice(node, networkId, reg?.name));
      }
    }
    return out.sort(deviceSort);
  }, [topologyByNetwork, registeredDevices]);

  const setHasCompletedOnboarding = useCallback(async (v: boolean) => {
    setHasCompletedOnboardingState(v);
    await AsyncStorage.setItem(KEYS.onboarded, v ? '1' : '0');
  }, []);

  const setMockLoggedIn = useCallback(async (v: boolean) => {
    setMockLoggedInState(v);
    await AsyncStorage.setItem(KEYS.session, v ? '1' : '0');
  }, []);

  const markAlertResolved = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
  }, []);

  const setThresholds = useCallback((t: Partial<SensorThresholds>) => {
    setThresholdsState((prev) => ({ ...prev, ...t }));
  }, []);

  const addPond = useCallback((p: Omit<Pond, 'id'>) => {
    const id = `pond-${Date.now()}`;
    setPonds((prev) => [...prev, { ...p, id }]);
  }, []);

  const logout = useCallback(async () => {
    await setMockLoggedIn(false);
  }, [setMockLoggedIn]);

  const addRegisteredDevice = useCallback(async (deviceId: string, options?: AddRegisteredOptions) => {
    const id = deviceId.trim();
    if (!id) return;
    setRegisteredDevices((prev) => {
      const existing = prev.find((r) => r.deviceId === id);
      const entry: RegisteredDevice = {
        deviceId: id,
        name: options?.name?.trim() || existing?.name || id,
        networkId: options?.networkId ?? existing?.networkId ?? '',
        roleHint: options?.roleHint ?? existing?.roleHint,
        rootGatewayId: options?.rootGatewayId ?? existing?.rootGatewayId,
        parentId: options?.parentId ?? existing?.parentId,
        registeredAt: existing?.registeredAt ?? new Date().toISOString(),
        provisionedAt: existing?.provisionedAt ?? new Date().toISOString(),
        pondId: options?.pondId ?? existing?.pondId ?? 'pond-a',
        bleProvisionName: options?.bleProvisionName ?? existing?.bleProvisionName,
        bleConfigName: options?.bleConfigName ?? existing?.bleConfigName,
      };
      return [entry, ...prev.filter((r) => r.deviceId !== id)];
    });
  }, []);

  const removeRegisteredDevice = useCallback(async (deviceId: string) => {
    setRegisteredDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
    setLiveSnapshots((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  }, []);

  const updateRegisteredDeviceName = useCallback(async (deviceId: string, name: string) => {
    setRegisteredDevices((prev) =>
      prev.map((d) => (d.deviceId === deviceId ? { ...d, name: name.trim() || d.deviceId } : d)),
    );
  }, []);

  const addCctvCamera = useCallback(async (camera: Omit<CctvCamera, 'id' | 'createdAt'>) => {
    const streamUrl = camera.streamUrl.trim();
    if (!streamUrl) return;
    const entry: CctvCamera = {
      id: `cctv_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name: camera.name.trim() || 'CCTV camera',
      streamUrl,
      location: camera.location?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    console.log('[CCTV Context] add camera', {
      id: entry.id,
      name: entry.name,
      url: entry.streamUrl,
    });
    setCctvCameras((prev) => [entry, ...prev]);
  }, []);

  const updateCctvCamera = useCallback(async (cameraId: string, camera: Omit<CctvCamera, 'id' | 'createdAt'>) => {
    const streamUrl = camera.streamUrl.trim();
    if (!streamUrl) return;
    console.log('[CCTV Context] update camera', {
      cameraId,
      name: camera.name,
      url: streamUrl,
    });
    setCctvCameras((prev) =>
      prev.map((item) =>
        item.id === cameraId
          ? {
              ...item,
              name: camera.name.trim() || item.name,
              streamUrl,
              location: camera.location?.trim() || undefined,
            }
          : item,
      ),
    );
  }, []);

  const removeCctvCamera = useCallback(async (cameraId: string) => {
    console.log('[CCTV Context] remove camera', { cameraId });
    setCctvCameras((prev) => prev.filter((camera) => camera.id !== cameraId));
  }, []);

  const getLiveSnapshot = useCallback(
    (deviceId: string): FirebaseDeviceSnapshot | undefined => liveSnapshots[deviceId],
    [liveSnapshots],
  );

  const allLiveDevices = useMemo(
    () => mergeLiveDevices(sourceNetworkDevices, liveChildDevices, ownLiveDevices, sourceTopologyDevices),
    [sourceNetworkDevices, liveChildDevices, ownLiveDevices, sourceTopologyDevices],
  );

  const getLiveDevice = useCallback(
    (deviceId: string): AquaDevice | null => allLiveDevices.find((d) => d.id === deviceId || d.sourceId === deviceId) ?? null,
    [allLiveDevices],
  );

  const getGatewayChildren = useCallback(
    (gatewayId: string): AquaDevice[] =>
      allLiveDevices
        .filter((d) => d.gatewayId === gatewayId || d.rootGatewayId === gatewayId)
        .filter((d) => d.id !== gatewayId)
        .sort(deviceSort),
    [allLiveDevices],
  );

  const getGatewayNetwork = useCallback(
    (gatewayId: string): Record<string, FirebaseNetworkNode> => networkByGateway[gatewayId] ?? {},
    [networkByGateway],
  );

  const getNetworkTree = useCallback(
    (gatewayId: string): AquaDevice[] => {
      const root = allLiveDevices.find((d) => d.id === gatewayId) ?? seedDevices.find((d) => d.id === gatewayId);
      const childrenForGateway = getGatewayChildren(gatewayId);
      return root ? [root, ...childrenForGateway] : childrenForGateway;
    },
    [allLiveDevices, getGatewayChildren],
  );

  const isRegisteredLiveDevice = useCallback(
    (deviceId: string) => registeredDevices.some((r) => r.deviceId === deviceId),
    [registeredDevices],
  );

  const ponds = useMemo(
    () =>
      pondsBase.map((p) => {
        if (p.id !== 'pond-a') return p;
        const liveIds = allLiveDevices.map((d) => d.id);
        return { ...p, deviceIds: [...new Set([...p.deviceIds, ...liveIds])] };
      }),
    [pondsBase, allLiveDevices],
  );

  const devices = useMemo(() => {
    const liveIds = new Set(allLiveDevices.map((d) => d.id));
    const base = seedDevices.filter((d) => !liveIds.has(d.id)).map((d) => ({ ...d, isDemo: true, isLive: false }));
    return [...allLiveDevices, ...base];
  }, [allLiveDevices]);

  const fullyHydrated = hydrated && hydratedRegistered;

  const value = useMemo<MockAppContextValue>(
    () => ({
      user: mockUser,
      ponds,
      devices,
      alerts,
      thresholds,
      tempUnit,
      tdsUnit,
      themePref,
      notificationsEnabled,
      hasCompletedOnboarding,
      mockLoggedIn,
      hydrated: fullyHydrated,
      registeredDevices,
      cctvCameras,
      firebaseRtdbConnected,
      setHasCompletedOnboarding,
      setMockLoggedIn,
      markAlertResolved,
      setThresholds,
      setTempUnit,
      setTdsUnit,
      setThemePref,
      setNotificationsEnabled,
      addPond,
      logout,
      addRegisteredDevice,
      removeRegisteredDevice,
      updateRegisteredDeviceName,
      addCctvCamera,
      updateCctvCamera,
      removeCctvCamera,
      getLiveDevice,
      getLiveSnapshot,
      getGatewayChildren,
      getNetworkTree,
      getGatewayNetwork,
      isRegisteredLiveDevice,
    }),
    [
      ponds,
      devices,
      alerts,
      thresholds,
      tempUnit,
      tdsUnit,
      themePref,
      notificationsEnabled,
      hasCompletedOnboarding,
      mockLoggedIn,
      fullyHydrated,
      registeredDevices,
      cctvCameras,
      firebaseRtdbConnected,
      setHasCompletedOnboarding,
      setMockLoggedIn,
      markAlertResolved,
      setThresholds,
      addPond,
      logout,
      addRegisteredDevice,
      removeRegisteredDevice,
      updateRegisteredDeviceName,
      addCctvCamera,
      updateCctvCamera,
      removeCctvCamera,
      getLiveDevice,
      getLiveSnapshot,
      getGatewayChildren,
      getNetworkTree,
      getGatewayNetwork,
      isRegisteredLiveDevice,
    ],
  );

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>;
}

export function useMockApp() {
  const ctx = useContext(MockAppContext);
  if (!ctx) throw new Error('useMockApp must be used within MockAppProvider');
  return ctx;
}
