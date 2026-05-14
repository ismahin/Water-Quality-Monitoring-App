/**
 * Shapes written by ESP32 firmware to Realtime Database (may include extra fields).
 */

export type FirebaseDeviceRole = 'SINGLE' | 'GATEWAY' | 'CHILD' | 'RELAY' | string;

export interface FirebaseLatestReading {
  device_id?: string;
  role?: FirebaseDeviceRole;
  hardware_mode?: FirebaseDeviceRole;
  ph?: number;
  tds?: number;
  temperature?: number;
  turbidity?: number;
  battery?: number;
  battery_voltage?: number;
  wifi_ssid?: string;
  wifi_rssi?: number;
  ip?: string;
  lora_enabled?: boolean;
  lora_initialized?: boolean;
  lora_gateway_ready?: boolean;
  lora_frequency_mhz?: number;
  lora_last_error?: string;
  lora_packet_count?: number;
  last_lora_rssi?: number;
  last_lora_snr?: number;
  uptime_ms?: number;
  sensor_status?: string;
  calibration_status?: string;
}

export interface FirebaseDeviceStatus {
  device_id?: string;
  role?: FirebaseDeviceRole;
  hardware_mode?: FirebaseDeviceRole;
  online?: boolean;
  wifi_connected?: boolean;
  wifi_ssid?: string;
  wifi_rssi?: number;
  ip?: string;
  lora_enabled?: boolean;
  lora_initialized?: boolean;
  lora_gateway_ready?: boolean;
  lora_frequency_mhz?: number;
  lora_last_error?: string;
  lora_packet_count?: number;
  last_lora_rssi?: number;
  last_lora_snr?: number;
  last_lora_payload?: string;
  sensor_mode?: string;
  command_stream?: 'connected' | 'disconnected' | string;
  last_upload_ms?: number;
  uptime_ms?: number;
  remove_requested?: boolean;
  reprovision_required?: boolean;
  message?: string;
  /** Legacy firmware field; prefer structured LoRa fields above */
  lora?: string;
}

export interface FirebaseDeviceSnapshot {
  latest: FirebaseLatestReading | null;
  status: FirebaseDeviceStatus | null;
  /** Local ISO timestamp when either latest or status snapshot was received */
  receivedAt: string;
}

/** Written by ESP32 at `devices/{id}/commands/reset_wifi_ack` after handling reset_wifi */
export interface ResetWifiAck {
  command_id?: string;
  status?: string;
  [key: string]: unknown;
}
