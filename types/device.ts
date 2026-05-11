import type { SensorSnapshot } from './sensor';

export type DeviceRole = 'single' | 'gateway' | 'relay' | 'child';

export type DeviceOnlineStatus = 'online' | 'offline';

export type CalibrationStatus = 'ok' | 'due' | 'overdue';

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
}

export interface GatewayDevice extends BaseDevice {
  role: 'gateway';
  wifiSsid: string;
  wifiRssi: number;
  cloudOnline: boolean;
  loraGatewayEnabled: boolean;
  childDeviceIds: string[];
}

export interface SingleDevice extends BaseDevice {
  role: 'single';
  wifiSsid: string;
  wifiRssi: number;
  cloudOnline: boolean;
}

export interface RelayDevice extends BaseDevice {
  role: 'relay';
  parentId: string;
  loraRssi: number;
  loraSnr: number;
  packetSuccessPercent: number;
  childDeviceIds: string[];
}

export interface ChildDevice extends BaseDevice {
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
