export type PairingDeviceRole = 'SINGLE' | 'GATEWAY' | 'RELAY' | 'CHILD' | 'UNPAIRED' | 'RELAY_CANDIDATE';

export type SwitchMode = 'NORMAL' | 'PAIRING';

export function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return toBool(value);
}

function toStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function toNumberField(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function normalizePairingRole(value: unknown): PairingDeviceRole {
  const role = typeof value === 'string' ? value.toUpperCase() : '';
  if (role === 'SINGLE' || role === 'GATEWAY' || role === 'RELAY' || role === 'CHILD' || role === 'UNPAIRED' || role === 'RELAY_CANDIDATE') return role;
  return 'UNPAIRED';
}

function normalizeSwitchMode(value: unknown): SwitchMode | string {
  const mode = typeof value === 'string' ? value.toUpperCase() : '';
  if (mode === 'PAIRING' || mode === 'NORMAL') return mode;
  return mode || 'PAIRING';
}

export type PairingCommand =
  | { cmd: 'info' }
  | { cmd: 'scan' }
  | { cmd: 'scan_wifi'; max_results?: number }
  | { cmd: 'wifi_scan'; max_results?: number }
  | { cmd: 'set_id'; device_id: string; network_id: string }
  | { cmd: 'set_wifi'; ssid: string; password: string; gateway: boolean }
  | { cmd: 'pair'; parent_id: string; role: 'CHILD' | 'RELAY'; network_id: string }
  | { cmd: 'reset_pair' }
  | { cmd: 'factory' };

export interface PairingDeviceInfo {
  type?: 'info';
  ok?: boolean;
  deviceId: string;
  networkId: string;
  role: PairingDeviceRole;
  switchMode: SwitchMode | string;
  parentId?: string;
  rootGatewayId?: string;
  gatewayUplinkEnabled?: boolean;
  relayEnabled?: boolean;
  depth?: number;
  sampleIntervalMs?: number;
  loraReady: boolean;
  wifiConnected?: boolean;
  hasWifiCredentials?: boolean;
  wifiSsid?: string;
  ip?: string;
  paired: boolean;
  bleConnected?: boolean;
  fw?: string;
  autoRelayPromotion?: boolean;
  smartRouting?: boolean;
  forwardQueueSize?: number;
}

export interface PairingBleInfo extends PairingDeviceInfo {
  device_id: string;
  network_id: string;
  switch_mode: SwitchMode | string;
  parent_id?: string;
  root_gateway_id?: string;
  gateway_uplink_enabled?: boolean;
  relay_enabled?: boolean;
  sample_interval_ms?: number;
  lora_ready: boolean;
  wifi_connected: boolean;
  has_wifi_credentials?: boolean;
  wifi_ssid?: string;
  ble_connected?: boolean;
  auto_relay_promotion?: boolean;
  smart_routing?: boolean;
  forward_queue_size?: number;
}

export function normalizeDeviceInfo(rawValue: unknown, fallbackDeviceId = ''): PairingBleInfo | null {
  if (!rawValue || typeof rawValue !== 'object') return null;
  const raw = rawValue as Record<string, unknown>;
  const deviceId = toStringField(raw.device_id) ?? toStringField(raw.deviceId) ?? fallbackDeviceId;
  if (!deviceId) return null;
  const networkId = toStringField(raw.network_id) ?? toStringField(raw.networkId) ?? 'POND_001';
  const switchMode = normalizeSwitchMode(raw.switch_mode ?? raw.switchMode);
  const parentId = toStringField(raw.parent_id) ?? toStringField(raw.parentId);
  const rootGatewayId = toStringField(raw.root_gateway_id) ?? toStringField(raw.rootGatewayId);
  const gatewayUplinkEnabled = toOptionalBool(raw.gateway_uplink_enabled ?? raw.gatewayUplinkEnabled);
  const relayEnabled = toOptionalBool(raw.relay_enabled ?? raw.relayEnabled);
  const sampleIntervalMs = toNumberField(raw.sample_interval_ms ?? raw.sampleIntervalMs);
  const wifiConnected = toOptionalBool(raw.wifi_connected ?? raw.wifiConnected);
  const hasWifiCredentials = toOptionalBool(raw.has_wifi_credentials ?? raw.hasWifiCredentials);
  const wifiSsid = toStringField(raw.wifi_ssid) ?? toStringField(raw.wifiSsid);
  const bleConnected = toOptionalBool(raw.ble_connected ?? raw.bleConnected);
  const autoRelayPromotion = toOptionalBool(raw.auto_relay_promotion ?? raw.autoRelayPromotion);
  const smartRouting = toOptionalBool(raw.smart_routing ?? raw.smartRouting);
  const forwardQueueSize = toNumberField(raw.forward_queue_size ?? raw.forwardQueueSize);
  const loraReady = toBool(raw.lora_ready) || toBool(raw.loraReady);
  const paired = toBool(raw.paired);

  return {
    type: 'info',
    ok: toOptionalBool(raw.ok),
    deviceId,
    networkId,
    role: normalizePairingRole(raw.role),
    switchMode,
    parentId,
    rootGatewayId,
    gatewayUplinkEnabled,
    relayEnabled,
    depth: toNumberField(raw.depth),
    sampleIntervalMs,
    loraReady,
    wifiConnected,
    hasWifiCredentials,
    wifiSsid,
    ip: toStringField(raw.ip),
    paired,
    bleConnected,
    fw: toStringField(raw.fw),
    autoRelayPromotion,
    smartRouting,
    forwardQueueSize,
    device_id: deviceId,
    network_id: networkId,
    switch_mode: switchMode,
    parent_id: parentId,
    root_gateway_id: rootGatewayId,
    gateway_uplink_enabled: gatewayUplinkEnabled,
    relay_enabled: relayEnabled,
    sample_interval_ms: sampleIntervalMs,
    lora_ready: loraReady,
    wifi_connected: wifiConnected ?? false,
    has_wifi_credentials: hasWifiCredentials,
    wifi_ssid: wifiSsid,
    ble_connected: bleConnected,
    auto_relay_promotion: autoRelayPromotion,
    smart_routing: smartRouting,
    forward_queue_size: forwardQueueSize,
  };
}

export interface PairingParent {
  id: string;
  role: PairingDeviceRole;
  network_id: string;
  root_gateway_id: string;
  parent_id?: string;
  depth: number;
  child_count?: number;
  max_children?: number;
  rssi?: number;
  snr?: number;
  age_ms?: number;
}

export interface PairingProgressState {
  bleConnected: boolean;
  infoLoaded: boolean;
  identitySaved?: boolean;
  wifiScanDone?: boolean;
  wifiSent?: boolean;
  wifiConnected?: boolean;
  roleSelected?: boolean;
  parentSelected?: boolean;
  pairStarted?: boolean;
  parentAccepted?: boolean;
  pairSaved?: boolean;
  serverTestSent?: boolean;
  serverTestConfirmed?: boolean;
  error?: string;
}

export interface WifiSetupResult {
  ok: boolean;
  stage?: 'connecting' | 'connected' | 'failed';
  ip?: string;
  message?: string;
}

export interface WifiScanItem {
  ssid: string;
  rssi: number;
  secure?: boolean;
  auth?: string;
  channel?: number;
  signal_level?: number;
}

export interface PairingBleDevice {
  id: string;
  name: string;
  deviceId: string;
  rssi: number;
}

export interface BleDebugState {
  connectedDeviceId?: string;
  connectedDeviceName?: string;
  serviceFound?: boolean;
  rxFound?: boolean;
  txFound?: boolean;
  txMonitorStarted?: boolean;
  lastCommand?: string;
  lastRawResponse?: string;
  lastDecodedResponse?: string;
  lastError?: string;
  lastInfoJson?: string;
  lastParentsJson?: string;
  rawInfoLoraReady?: string;
  normalizedInfoLoraReady?: string;
}

export type PairingNotification =
  | ({ type: 'info' } & PairingBleInfo)
  | { type: 'parents'; items: PairingParent[] }
  | { type: 'wifi_scan'; ok?: boolean; device_id?: string; count?: number; total_found?: number; items?: WifiScanItem[]; message?: string }
  | { type: 'set_id'; ok: boolean; message?: string }
  | ({ type: 'wifi_result' } & WifiSetupResult)
  | { type: 'pair_started'; ok: boolean; parent_id?: string; role?: 'CHILD' | 'RELAY'; message?: string }
  | { type: 'pair_result'; ok: boolean; stage?: string; parent_id?: string; root_gateway_id?: string; message?: string }
  | { type: 'server_test'; status: 'sent' | string; test_id?: string; message?: string }
  | { type: 'reset_pair'; ok: boolean; message?: string }
  | { type: 'factory'; ok: boolean; message?: string }
  | { type: string; ok?: boolean; message?: string; [key: string]: unknown };

export type PairingWizardStep = 'instructions' | 'ble' | 'info' | 'role' | 'parent' | 'connect' | 'test' | 'done';
