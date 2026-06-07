export type PairingDeviceRole = 'SINGLE' | 'GATEWAY' | 'RELAY' | 'CHILD' | 'UNPAIRED' | 'RELAY_CANDIDATE';

export type SwitchMode = 'NORMAL' | 'PAIRING';

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

export interface PairingBleInfo {
  device_id: string;
  network_id: string;
  role: PairingDeviceRole;
  switch_mode: SwitchMode;
  parent_id?: string;
  root_gateway_id?: string;
  lora_ready: boolean;
  wifi_connected: boolean;
  paired: boolean;
}

export interface PairingParent {
  id: string;
  role: PairingDeviceRole;
  network_id: string;
  root_gateway_id: string;
  parent_id?: string;
  depth: number;
  child_count: number;
  max_children: number;
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
