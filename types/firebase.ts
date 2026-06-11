/**
 * Shapes written by ESP32 firmware to Realtime Database (may include extra fields).
 */

export type FirebaseDeviceRole = 'SINGLE' | 'GATEWAY' | 'CHILD' | 'RELAY' | string;

export type FirebaseChildLifecycleState =
  | 'PAIR_ACCEPTED_WAITING_ACK'
  | 'PAIR_SAVED_WAITING_TEST'
  | 'ACTIVE'
  | 'OFFLINE'
  | 'STALE'
  | string;

export interface FirebasePairLifecycleFields {
  schema_version?: number;
  pair_stage?: FirebaseChildLifecycleState;
  pair_confirmed?: boolean;
  telemetry_received?: boolean;
  lifecycle_state?: FirebaseChildLifecycleState;
  paired_at_ms?: number;
  pair_updated_ms?: number;
  last_pair_event?: string;
  message?: string;
}

export interface FirebaseLatestReading {
  device_id?: string;
  role?: FirebaseDeviceRole;
  hardware_mode?: FirebaseDeviceRole;
  gateway_uplink_enabled?: boolean;
  relay_enabled?: boolean;
  ph?: number;
  tds?: number;
  temperature?: number;
  turbidity?: number;
  battery?: number;
  battery_voltage?: number;
  wifi_ssid?: string;
  wifi_rssi?: number;
  ip?: string;
  lora_ready?: boolean;
  lora_error?: string;
  lora_enabled?: boolean;
  lora_initialized?: boolean;
  lora_gateway_ready?: boolean;
  lora_frequency_mhz?: number;
  lora_last_error?: string;
  lora_packet_count?: number;
  last_lora_rssi?: number;
  last_lora_snr?: number;
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  uptime_ms?: number;
  sensor_status?: string;
  calibration_status?: string;
}

export interface FirebaseDeviceStatus extends FirebasePairLifecycleFields {
  device_id?: string;
  role?: FirebaseDeviceRole;
  hardware_mode?: FirebaseDeviceRole;
  gateway_uplink_enabled?: boolean;
  relay_enabled?: boolean;
  online?: boolean;
  wifi_connected?: boolean;
  wifi_ssid?: string;
  wifi_rssi?: number;
  ip?: string;
  lora_ready?: boolean;
  lora_error?: string;
  lora_enabled?: boolean;
  lora_initialized?: boolean;
  lora_gateway_ready?: boolean;
  lora_frequency_mhz?: number;
  lora_last_error?: string;
  lora_packet_count?: number;
  last_lora_rssi?: number;
  last_lora_snr?: number;
  last_lora_payload?: string;
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  forward_queue?: number;
  ble_config_connected?: boolean;
  sensor_mode?: string;
  command_stream?: 'connected' | 'disconnected' | string;
  last_upload_ms?: number;
  uptime_ms?: number;
  remove_requested?: boolean;
  reprovision_required?: boolean;
  /** Legacy firmware field; prefer structured LoRa fields above */
  lora?: string;
}

export interface FirebaseDeviceSnapshot {
  latest: FirebaseLatestReading | null;
  status: FirebaseDeviceStatus | null;
  /** Local ISO timestamp when either latest or status snapshot was received */
  receivedAt: string;
}

export interface FirebaseChildLatest {
  source_id?: string;
  role?: FirebaseDeviceRole;
  forwarded_by?: string;
  route?: string;
  gateway_id?: string;
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  ph?: number;
  tds?: number;
  temperature?: number;
  turbidity?: number;
  battery?: number;
  battery_voltage?: number;
  seq?: number;
  sid?: number;
  child_rssi?: number;
  child_snr?: number;
  gateway_rssi?: number;
  gateway_snr?: number;
  last_upload_ms?: number;
  uptime_ms?: number;
  relay_enabled?: boolean;
  gateway_uplink_enabled?: boolean;
}

export interface FirebaseChildStatus extends FirebasePairLifecycleFields {
  source_id?: string;
  device_id?: string;
  role?: FirebaseDeviceRole;
  online?: boolean;
  forwarded_by?: string;
  route?: string;
  gateway_id?: string;
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  lora_ready?: boolean;
  lora_error?: string;
  child_rssi?: number;
  child_snr?: number;
  gateway_rssi?: number;
  gateway_snr?: number;
  last_upload_ms?: number;
  uptime_ms?: number;
  relay_enabled?: boolean;
  gateway_uplink_enabled?: boolean;
}

export interface FirebaseNetworkNode {
  device_id?: string;
  source_id?: string;
  role?: FirebaseDeviceRole;
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  forwarded_by?: string;
  route?: string;
  online?: boolean;
  relay_enabled?: boolean;
  gateway_uplink_enabled?: boolean;
  lora_ready?: boolean;
  lora_error?: string;
  last_seen_ms?: number;
  last_upload_ms?: number;
  child_rssi?: number;
  child_snr?: number;
  gateway_rssi?: number;
  gateway_snr?: number;
  battery?: number;
  schema_version?: number;
  pair_stage?: FirebaseChildLifecycleState;
  pair_confirmed?: boolean;
  telemetry_received?: boolean;
  lifecycle_state?: FirebaseChildLifecycleState;
  paired_at_ms?: number;
  pair_updated_ms?: number;
  last_pair_event?: string;
  message?: string;
  [key: string]: unknown;
}

export interface FirebaseChildSnapshot {
  latest: FirebaseChildLatest | null;
  status: FirebaseChildStatus | null;
  network?: FirebaseNetworkNode | null;
  receivedAt: string;
}

export interface FirebaseDeviceIdentity {
  device_id?: string;
  role?: string;
  hardware_mode?: string;
  network_id?: string;
  parent_id?: string;
  root_gateway_id?: string;
  firmware_version?: string;
  schema_version?: number;
}

export interface FirebaseDeviceLink {
  parent_id?: string;
  root_gateway_id?: string;
  network_id?: string;
  role?: string;
  route?: string;
  depth?: number;
  pair_confirmed?: boolean;
  telemetry_received?: boolean;
  lifecycle_state?: FirebaseChildLifecycleState;
}

/** Written by ESP32 at `devices/{id}/commands/reset_wifi_ack` after handling reset_wifi */
export interface ResetWifiAck {
  command_id?: string;
  status?: string;
  [key: string]: unknown;
}
