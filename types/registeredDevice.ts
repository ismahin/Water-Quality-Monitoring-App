export interface RegisteredDevice {
  deviceId: string;
  name: string;
  role: 'single' | 'gateway';
  pondId: string;
  provisionedAt: string;
  /** Exact BLE name used for ESP-IDF provisioning (e.g. PROV_WQM_…). Used for Re-provision Wi‑Fi. */
  bleProvisionName?: string;
}
