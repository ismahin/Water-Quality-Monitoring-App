import type { Device, Subscription } from 'react-native-ble-plx';
import { requestAndroidBleRuntimePermissions, requestAndroidFineLocationRuntimePermission } from '../../utils/requestAndroidBlePermissions';
import { decodeBleText, encodeBleCommand } from '../../utils/pairingUtils';
import { BleConfigError, getSharedBleManager, MOCK_BLE_CONFIG } from './bleConfigService';

export type BaseBleScanItem = {
  id: string;
  name: string;
  rssi: number;
};

export type BaseBleScanSeenDevice = BaseBleScanItem & {
  advertisedName?: string | null;
  localName?: string | null;
  serviceUUIDs?: string[];
};

export type BaseBleScanStats = {
  totalAdvertisements: number;
  namedAdvertisements: number;
  matchedAdvertisements: number;
  nearbyDevices: BaseBleScanSeenDevice[];
};

export type BaseBleDebugPatch = {
  serviceFound?: boolean;
  rxFound?: boolean;
  txFound?: boolean;
  txMonitorStarted?: boolean;
  lastCommand?: string;
  lastRawResponse?: string;
  lastDecodedResponse?: string;
  lastError?: string;
};

export function baseBleErrorMessage(error: unknown): string {
  if (error instanceof BleConfigError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  const low = message.toLowerCase();
  if (low.includes('createclient') || low.includes('native module') || low.includes('null')) {
    return 'BLE scanning requires an Android build that includes react-native-ble-plx. Rebuild and reinstall the app, then try again.';
  }
  if (low.includes('disconnected')) return 'Bluetooth disconnected. Please reconnect the device.';
  if (low.includes('poweredoff') || (low.includes('bluetooth') && low.includes('off'))) return 'Bluetooth is turned off. Turn Bluetooth on and try again.';
  return message || 'BLE operation failed.';
}

export async function requestBlePermissions(): Promise<{ ok: true } | { ok: false; message: string }> {
  const ble = await requestAndroidBleRuntimePermissions();
  if (!ble.ok) return ble;
  const location = await requestAndroidFineLocationRuntimePermission();
  if (!location.ok) return location;
  return { ok: true };
}

export async function scanDevices(params: {
  serviceUuid?: string;
  namePrefix: string | string[];
  onDevice: (device: BaseBleScanItem) => void;
  onError: (message: string) => void;
  onStats?: (stats: BaseBleScanStats) => void;
  mockDevices?: BaseBleScanItem[];
}): Promise<void> {
  const permissions = await requestBlePermissions();
  if (!permissions.ok) {
    params.onError(permissions.message);
    return;
  }

  if (MOCK_BLE_CONFIG) {
    params.mockDevices?.forEach((device, index) => {
      setTimeout(() => params.onDevice(device), 250 + index * 180);
    });
    params.onStats?.({
      totalAdvertisements: params.mockDevices?.length ?? 0,
      namedAdvertisements: params.mockDevices?.length ?? 0,
      matchedAdvertisements: params.mockDevices?.length ?? 0,
      nearbyDevices: params.mockDevices ?? [],
    });
    return;
  }

  try {
    const manager = getSharedBleManager();
    const state = await manager.state();
    if (state !== 'PoweredOn') {
      params.onError('Bluetooth is turned off. Turn Bluetooth on and try again.');
      return;
    }
    const namePrefixes = Array.isArray(params.namePrefix) ? params.namePrefix : [params.namePrefix];
    let totalAdvertisements = 0;
    let namedAdvertisements = 0;
    let matchedAdvertisements = 0;
    const nearbyDevices = new Map<string, BaseBleScanSeenDevice>();
    const emitStats = () => {
      params.onStats?.({
        totalAdvertisements,
        namedAdvertisements,
        matchedAdvertisements,
        nearbyDevices: Array.from(nearbyDevices.values()).sort((a, b) => b.rssi - a.rssi).slice(0, 12),
      });
    };

    console.log(
      `[AquaNode][BLE_SCAN] Starting scan prefixes=${namePrefixes.join('|')} service=${params.serviceUuid ?? 'any'} allowDuplicates=true`,
    );
    manager.startDeviceScan(params.serviceUuid ? [params.serviceUuid] : null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        console.log('[AquaNode][BLE_SCAN] Scan error:', error);
        params.onError(baseBleErrorMessage(error));
        return;
      }

      totalAdvertisements += 1;
      if (!device) {
        if (totalAdvertisements % 25 === 0) emitStats();
        return;
      }

      const name = device.name ?? device.localName ?? '';
      if (!name) {
        if (totalAdvertisements % 25 === 0) emitStats();
        return;
      }

      namedAdvertisements += 1;
      const existing = nearbyDevices.get(device.id);
      const seenDevice: BaseBleScanSeenDevice = {
        id: device.id,
        name,
        advertisedName: device.name,
        localName: device.localName,
        rssi: device.rssi ?? -100,
        serviceUUIDs: device.serviceUUIDs ?? [],
      };
      if (!existing || seenDevice.rssi > existing.rssi || existing.name !== seenDevice.name) {
        nearbyDevices.set(device.id, seenDevice);
        const serviceUUIDs = seenDevice.serviceUUIDs ?? [];
        console.log(
          `[AquaNode][BLE_SCAN] Seen name="${name}" id=${device.id} rssi=${seenDevice.rssi} services=${serviceUUIDs.join(',') || 'none'}`,
        );
        emitStats();
      }

      if (!namePrefixes.some((prefix) => name.startsWith(prefix))) return;
      matchedAdvertisements += 1;
      console.log(`[AquaNode][BLE_SCAN] Matched AquaNode device name="${name}" id=${device.id} rssi=${device.rssi ?? -100}`);
      emitStats();
      params.onDevice({ id: device.id, name, rssi: device.rssi ?? -100 });
    });
  } catch (error) {
    params.onError(baseBleErrorMessage(error));
  }
}

export function stopScan(): void {
  if (MOCK_BLE_CONFIG) return;
  try {
    getSharedBleManager().stopDeviceScan();
  } catch {
    /* noop */
  }
}

export async function connectToDevice(deviceId: string): Promise<Device> {
  try {
    const manager = getSharedBleManager();
    const device = await manager.connectToDevice(deviceId, { timeout: 12_000 });
    const discovered = await device.discoverAllServicesAndCharacteristics();
    console.log('[BLE] Connected:', discovered.id, discovered.name ?? discovered.localName ?? deviceId);
    console.log('[BLE] Services discovered');
    return discovered;
  } catch (error) {
    throw new Error(baseBleErrorMessage(error));
  }
}

export async function disconnectDevice(device: Device | null): Promise<void> {
  if (!device) return;
  try {
    await device.cancelConnection();
  } catch {
    /* noop */
  }
}

export async function writeJson(device: Device, serviceUuid: string, characteristicUuid: string, command: unknown): Promise<void> {
  try {
    const commandJson = JSON.stringify(command);
    console.log('[BLE TX->RX] Sending command:', commandJson);
    await device.writeCharacteristicWithResponseForService(serviceUuid, characteristicUuid, encodeBleCommand(command));
  } catch (error) {
    throw new Error(baseBleErrorMessage(error));
  }
}

export function monitorJson<T>(
  device: Device,
  serviceUuid: string,
  characteristicUuid: string,
  callback: (value: T) => void,
  onError?: (message: string) => void,
  onDebug?: (patch: BaseBleDebugPatch) => void,
): Subscription {
  console.log('[BLE] TX notification monitor started');
  onDebug?.({ txMonitorStarted: true });
  return device.monitorCharacteristicForService(serviceUuid, characteristicUuid, (error, characteristic) => {
    if (error) {
      const message = baseBleErrorMessage(error);
      console.warn('[BLE JSON ERROR]', 'monitor error', error);
      onDebug?.({ lastError: message });
      onError?.(message);
      return;
    }
    const raw = characteristic?.value ?? '';
    const decoded = decodeBleText(raw);
    console.log('[BLE RX<-TX] Raw base64:', raw);
    console.log('[BLE RX<-TX] Decoded:', decoded ?? '');
    onDebug?.({ lastRawResponse: raw, lastDecodedResponse: decoded ?? undefined });
    if (!decoded) return;
    try {
      const value = JSON.parse(decoded) as T;
      console.log('[BLE JSON]', value);
      callback(value);
    } catch (parseError) {
      console.warn('[BLE JSON ERROR]', decoded, parseError);
      onDebug?.({ lastError: parseError instanceof Error ? parseError.message : String(parseError) });
    }
  });
}
