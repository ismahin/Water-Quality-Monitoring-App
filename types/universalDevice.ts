export type UniversalRole = 'SINGLE' | 'GATEWAY' | 'CHILD' | 'RELAY' | 'UNCONFIGURED';

export type HardwareMode = 'SINGLE' | 'NETWORK';

export type LoRaStatus = 'disabled' | 'ready' | 'error' | 'unknown';

export interface UniversalDeviceConfig {
  deviceId: string;
  networkId: string;
  parentId: string;
  rootGatewayId: string;
  gatewayUplinkEnabled: boolean;
  relayEnabled: boolean;
  sampleIntervalMs: number;
}

export interface BleConfigResponse<T = unknown> {
  ok: boolean;
  cmd?: string;
  message?: string;
  error?: string;
  status?: string;
  config?: UniversalDeviceConfig;
  data?: T;
  raw?: unknown;
}

export interface RegisteredDevice {
  deviceId: string;
  name: string;
  networkId: string;
  roleHint?: UniversalRole | string;
  rootGatewayId?: string;
  parentId?: string;
  registeredAt: string;
  pondId?: string;
  bleProvisionName?: string;
  bleConfigName?: string;
  provisionedAt?: string;
}

export function normalizeUniversalRole(value: unknown): UniversalRole {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (v === 'SINGLE' || v === 'GATEWAY' || v === 'CHILD' || v === 'RELAY') return v;
  return 'UNCONFIGURED';
}

export function normalizeHardwareMode(value: unknown): HardwareMode | undefined {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (v === 'SINGLE' || v === 'NETWORK') return v;
  return undefined;
}

export function deriveUniversalRole(input: {
  role?: unknown;
  hardwareMode?: unknown;
  gatewayUplinkEnabled?: unknown;
  relayEnabled?: unknown;
  loraReady?: unknown;
}): UniversalRole {
  const firmwareRole = normalizeUniversalRole(input.role);
  const hardwareMode = normalizeHardwareMode(input.hardwareMode);

  if (hardwareMode === 'SINGLE' || firmwareRole === 'SINGLE') return 'SINGLE';
  if (input.loraReady === false && firmwareRole === 'UNCONFIGURED') return 'UNCONFIGURED';
  if (input.gatewayUplinkEnabled === true || firmwareRole === 'GATEWAY') return 'GATEWAY';
  if (input.relayEnabled === true || firmwareRole === 'RELAY') return 'RELAY';
  if (hardwareMode === 'NETWORK' || firmwareRole === 'CHILD') return 'CHILD';
  return 'UNCONFIGURED';
}

export function roleToLegacyDeviceRole(role: UniversalRole): 'single' | 'gateway' | 'relay' | 'child' {
  switch (role) {
    case 'GATEWAY':
      return 'gateway';
    case 'RELAY':
      return 'relay';
    case 'CHILD':
      return 'child';
    case 'SINGLE':
    case 'UNCONFIGURED':
    default:
      return 'single';
  }
}
