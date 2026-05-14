import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@aquanode/lastBleProvisioningTarget';

export interface LastBleProvisioningTarget {
  deviceName: string;
  rssi: number;
  updatedAt: string;
}

function isValidProvisionName(name: string): boolean {
  const n = name.trim();
  return n.startsWith('PROV_') && n.length > 'PROV_'.length;
}

export async function loadLastBleProvisioningTarget(): Promise<LastBleProvisioningTarget | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const deviceName = typeof o.deviceName === 'string' ? o.deviceName : '';
    const rssi = typeof o.rssi === 'number' && Number.isFinite(o.rssi) ? o.rssi : -70;
    const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : new Date(0).toISOString();
    if (!isValidProvisionName(deviceName)) return null;
    return { deviceName: deviceName.trim(), rssi, updatedAt };
  } catch {
    return null;
  }
}

export async function saveLastBleProvisioningTarget(deviceName: string, rssi: number): Promise<void> {
  if (!isValidProvisionName(deviceName)) return;
  const payload: LastBleProvisioningTarget = {
    deviceName: deviceName.trim(),
    rssi: Number.isFinite(rssi) ? rssi : -70,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearLastBleProvisioningTarget(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
