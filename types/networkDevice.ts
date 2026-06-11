import type { PairingDeviceRole } from './pairing';

export interface DeviceLatest {
  device_id?: string;
  role?: PairingDeviceRole;
  network_id?: string;
  parent_id?: string;
  root_gateway_id?: string;
  route?: string;
  ph?: number;
  td?: number;
  tds?: number;
  tm?: number;
  temp?: number;
  temperature?: number;
  tb?: number;
  turbidity?: number;
  bt?: number;
  battery?: number;
  rc?: number;
  tc?: number;
  fc?: number;
  kc?: number;
  timestamp?: number;
  last_seen_ms?: number;
  rssi?: number;
  snr?: number;
}

export interface DeviceStatus {
  online?: boolean;
  role?: PairingDeviceRole;
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  last_seen_ms?: number;
  battery?: number;
  rssi?: number;
  snr?: number;
  pair_stage?: string;
  pair_confirmed?: boolean;
  telemetry_received?: boolean;
  lifecycle_state?: string;
  message?: string;
}

export interface NetworkDevice {
  id: string;
  latest: DeviceLatest | null;
  status: DeviceStatus | null;
  displayRole: PairingDeviceRole;
  online: boolean | null;
  lastSeenMs?: number;
  hasChildren?: boolean;
}

export interface TopologyNode {
  device_id: string;
  role?: PairingDeviceRole;
  parent_id?: string;
  root_gateway_id?: string;
  depth?: number;
  route?: string;
  online?: boolean;
  last_seen_ms?: number;
  battery?: number;
  rssi?: number;
  snr?: number;
  pair_stage?: string;
  pair_confirmed?: boolean;
  telemetry_received?: boolean;
  lifecycle_state?: string;
  message?: string;
  children?: TopologyNode[];
}

export interface PairingTestRecord {
  test_id?: string;
  device_id?: string;
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  role?: PairingDeviceRole;
  received_at?: number | string;
  status?: string;
  [key: string]: unknown;
}
