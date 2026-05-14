// TODO: MQTT / additional cloud paths — OTA status, remote config.
// TODO: Backend API integration — replace mock alerts/thresholds with API + caching.

import type { AquaAlert } from '../types/alert';
import type { AquaDevice } from '../types/device';
import type { Pond } from '../types/pond';
import type { SensorSeriesPoint, SensorSnapshot, SensorThresholds } from '../types/sensor';

export const mockUser = {
  firstName: 'Rafiqul',
  email: 'rafiqul@example.com',
};

export const mockThresholds: SensorThresholds = {
  phMin: 6.5,
  phMax: 8.5,
  tdsMaxPpm: 500,
  tempMinC: 20,
  tempMaxC: 32,
  turbidityMaxNtu: 25,
};

export const mockPonds: Pond[] = [
  {
    id: 'pond-a',
    name: 'Pond A',
    location: 'North Farm',
    deviceIds: ['m1', 'c1', 'c2'],
    overallScore: 86,
    healthStatus: 'good',
    activeAlertCount: 2,
    lastSyncAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'pond-b',
    name: 'Pond B',
    location: 'South Hatchery',
    deviceIds: ['s1'],
    overallScore: 62,
    healthStatus: 'warning',
    activeAlertCount: 3,
    lastSyncAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
];

const pondASensorsM1: SensorSnapshot = {
  ph: 7.21,
  tdsPpm: 342,
  temperatureC: 28.6,
  turbidityNtu: 14,
};

const pondASensorsC1: SensorSnapshot = {
  ph: 7.33,
  tdsPpm: 355,
  temperatureC: 28.9,
  turbidityNtu: 16,
};

const pondASensorsC2: SensorSnapshot = {
  ph: 6.91,
  tdsPpm: 370,
  temperatureC: 29.1,
  turbidityNtu: 26,
};

export const mockDevices: AquaDevice[] = [
  {
    id: 'm1',
    name: 'M1 Gateway',
    role: 'gateway',
    pondId: 'pond-a',
    online: 'online',
    batteryPercent: 100,
    lastSeenAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    lastDataAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    sensors: pondASensorsM1,
    calibrationStatus: 'ok',
    calibrationDueAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    firmwareVersion: '1.0.0',
    availableFirmwareVersion: '1.0.1',
    wifiSsid: 'Home_2.4G',
    wifiRssi: -54,
    cloudOnline: true,
    loraGatewayEnabled: true,
    childDeviceIds: ['c1'],
  },
  {
    id: 'c1',
    name: 'C1 Relay',
    role: 'relay',
    pondId: 'pond-a',
    parentId: 'm1',
    online: 'online',
    batteryPercent: 88,
    lastSeenAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    lastDataAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    sensors: pondASensorsC1,
    calibrationStatus: 'due',
    calibrationDueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    firmwareVersion: '1.0.0',
    loraRssi: -86,
    loraSnr: 8.2,
    packetSuccessPercent: 97,
    childDeviceIds: ['c2'],
  },
  {
    id: 'c2',
    name: 'C2 Child',
    role: 'child',
    pondId: 'pond-a',
    parentId: 'c1',
    online: 'online',
    batteryPercent: 76,
    lastSeenAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    lastDataAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    sensors: pondASensorsC2,
    calibrationStatus: 'ok',
    firmwareVersion: '1.0.0',
    loraRssi: -101,
    loraSnr: 3.5,
    packetSuccessPercent: 88,
  },
  {
    id: 's1',
    name: 'S1 Field Unit',
    role: 'single',
    pondId: 'pond-b',
    online: 'online',
    batteryPercent: 92,
    lastSeenAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    lastDataAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    sensors: {
      ph: 7.05,
      tdsPpm: 410,
      temperatureC: 27.2,
      turbidityNtu: 22,
    },
    calibrationStatus: 'overdue',
    firmwareVersion: '0.9.8',
    wifiSsid: 'Farm_Office',
    wifiRssi: -72,
    cloudOnline: true,
  },
];

export const mockAlerts: AquaAlert[] = [
  {
    id: 'a1',
    title: 'High turbidity at C2',
    description: 'Turbidity crossed the warning threshold for sustained readings.',
    severity: 'warning',
    deviceId: 'c2',
    pondId: 'pond-a',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    suggestedAction: 'Inspect aeration and inlet clarity; clean turbidity window if fouled.',
    resolved: false,
    sensorKind: 'turbidity',
    readingValue: '26 NTU',
  },
  {
    id: 'a2',
    title: 'Low battery at C1',
    description: 'Battery is below recommended level for field deployment.',
    severity: 'warning',
    deviceId: 'c1',
    pondId: 'pond-a',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    suggestedAction: 'Schedule a site visit to swap or recharge the battery pack.',
    resolved: false,
  },
  {
    id: 'a3',
    title: 'pH warning at M1',
    description: 'pH drifted toward the lower bound during the last sync window.',
    severity: 'info',
    deviceId: 'm1',
    pondId: 'pond-a',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    suggestedAction: 'Verify buffer calibration and check for biofilm on the pH probe.',
    resolved: false,
    sensorKind: 'ph',
    readingValue: '7.21',
  },
  {
    id: 'a4',
    title: 'Gateway offline',
    description: 'Gateway has not reported telemetry for 45 minutes.',
    severity: 'critical',
    deviceId: 'm1',
    pondId: 'pond-a',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    suggestedAction: 'Check power, Wi-Fi coverage, and cloud status from diagnostics.',
    resolved: true,
  },
  {
    id: 'a5',
    title: 'Calibration due',
    description: 'C1 calibration is due within 3 days.',
    severity: 'info',
    deviceId: 'c1',
    pondId: 'pond-a',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    suggestedAction: 'Run the calibration wizard with fresh buffer solutions.',
    resolved: false,
  },
];

export function mockPhTrend(): SensorSeriesPoint[] {
  return [
    { label: '6a', value: 7.05 },
    { label: '9a', value: 7.12 },
    { label: '12p', value: 7.18 },
    { label: '3p', value: 7.21 },
    { label: '6p', value: 7.19 },
    { label: '9p', value: 7.21 },
  ];
}

export function mockScoreTrend(): SensorSeriesPoint[] {
  return [
    { label: 'Mon', value: 82 },
    { label: 'Tue', value: 84 },
    { label: 'Wed', value: 83 },
    { label: 'Thu', value: 85 },
    { label: 'Fri', value: 86 },
    { label: 'Sat', value: 86 },
  ];
}

export function mockSignalHistory(): SensorSeriesPoint[] {
  return [
    { label: '-10m', value: -92 },
    { label: '-8m', value: -90 },
    { label: '-6m', value: -89 },
    { label: '-4m', value: -88 },
    { label: '-2m', value: -89 },
    { label: 'now', value: -89 },
  ];
}

export const mockBleDevices = [
  { id: 'ble-1', name: 'WQM_A1B2C3', rssi: -61 },
  { id: 'ble-2', name: 'WQM_C1D2E3', rssi: -74 },
];

export const mockWifiNetworks = ['Home_2.4G', 'Farm_Office', 'Pond_Network'];

export function getDeviceById(id: string): AquaDevice | undefined {
  return mockDevices.find((d) => d.id === id);
}

export function getPondById(id: string): Pond | undefined {
  return mockPonds.find((p) => p.id === id);
}

export function getChildren(parentId: string): AquaDevice[] {
  return mockDevices.filter((d) => 'parentId' in d && d.parentId === parentId);
}

export function getParentName(device: AquaDevice): string | undefined {
  if (!('parentId' in device)) return undefined;
  return mockDevices.find((d) => d.id === device.parentId)?.name;
}
