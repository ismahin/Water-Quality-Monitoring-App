import type { SensorSnapshot } from './sensor';
import type { HardwareMode, LoRaStatus, UniversalRole } from './universalDevice';

export type DeviceRole = 'single' | 'gateway' | 'relay' | 'child';

export type DeviceOnlineStatus = 'online' | 'offline' | 'warning';

export type CalibrationStatus = 'ok' | 'due' | 'overdue';

/** Optional fields populated from Firebase for live gateway / single devices */
export interface LiveFirebaseDeviceFields {
  firebaseRole?: string;
  universalRole?: UniversalRole;
  hardwareMode?: HardwareMode | string;
  networkId?: string;
  parentId?: string;
  rootGatewayId?: string;
  gatewayUplinkEnabled?: boolean;
  relayEnabled?: boolean;
  route?: string;
  forwardedBy?: string;
  isLive?: boolean;
  isDemo?: boolean;
  sourceId?: string;
  gatewayId?: string;
  ip?: string;
  wifiConnected?: boolean;
  sensorMode?: string;
  commandStream?: string;
  removeRequested?: boolean;
  reprovisionRequired?: boolean;
  firebaseMessage?: string;
  loraEnabled?: boolean;
  loraStatus?: LoRaStatus;
  loraReady?: boolean;
  loraInitialized?: boolean;
  loraGatewayReady?: boolean;
  loraFrequencyMhz?: number;
  loraLastError?: string;
  loraPacketCount?: number;
  lastLoraRssi?: number;
  lastLoraSnr?: number;
  childRssi?: number;
  childSnr?: number;
  gatewayRssi?: number;
  gatewaySnr?: number;
  lastLoraPayload?: string;
  forwardQueue?: number;
  bleConfigConnected?: boolean;
  /** True when Firebase says online but app has not received an update within the stale window */
  telemetryStale?: boolean;
  /** Raw firmware string from `latest.sensor_status` (e.g. MOCK) */
  sensorStatus?: string;
  /** Raw firmware string from `latest.calibration_status` */
  firebaseCalibrationStatus?: string;
}

export interface BaseDevice {
  id: string;
  name: string;
  role: DeviceRole;
  pondId: string;
  online: DeviceOnlineStatus;
  batteryPercent: number;
  lastSeenAt: string;
  lastDataAt: string;
  sensors: SensorSnapshot;
  calibrationStatus: CalibrationStatus;
  calibrationDueAt?: string;
  firmwareVersion: string;
  availableFirmwareVersion?: string;
  universalRole?: UniversalRole;
  hardwareMode?: HardwareMode | string;
  networkId?: string;
  rootGatewayId?: string;
  gatewayUplinkEnabled?: boolean;
  relayEnabled?: boolean;
  route?: string;
  forwardedBy?: string;
  sourceId?: string;
  gatewayId?: string;
  isLive?: boolean;
  isDemo?: boolean;
}

export interface GatewayDevice extends BaseDevice, LiveFirebaseDeviceFields {
  role: 'gateway';
  wifiSsid: string;
  wifiRssi: number;
  cloudOnline: boolean;
  loraGatewayEnabled: boolean;
  childDeviceIds: string[];
}

export interface SingleDevice extends BaseDevice, LiveFirebaseDeviceFields {
  role: 'single';
  wifiSsid: string;
  wifiRssi: number;
  cloudOnline: boolean;
}

export interface RelayDevice extends BaseDevice, LiveFirebaseDeviceFields {
  role: 'relay';
  parentId: string;
  loraRssi: number;
  loraSnr: number;
  packetSuccessPercent: number;
  childDeviceIds: string[];
}

export interface ChildDevice extends BaseDevice, LiveFirebaseDeviceFields {
  role: 'child';
  parentId: string;
  loraRssi: number;
  loraSnr: number;
  packetSuccessPercent: number;
}

export type AquaDevice = GatewayDevice | SingleDevice | RelayDevice | ChildDevice;

export function isGatewayOrSingle(d: AquaDevice): d is GatewayDevice | SingleDevice {
  return d.role === 'gateway' || d.role === 'single';
}

export function usesWifiUi(d: AquaDevice): d is GatewayDevice | SingleDevice {
  return d.role === 'gateway' || d.role === 'single';
}

export function usesLoraUi(d: AquaDevice): d is RelayDevice | ChildDevice {
  return d.role === 'relay' || d.role === 'child';
}
