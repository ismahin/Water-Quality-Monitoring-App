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
  matchServiceUuid?: string;
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
    const matchServiceUuid = params.matchServiceUuid ?? params.serviceUuid;
    let totalAdvertisements = 0;
    let namedAdvertisements = 0;
    let matchedAdvertisements = 0;
    let lastStatsAt = 0;
    const nearbyDevices = new Map<string, BaseBleScanSeenDevice>();
    const emitStats = (force = false) => {
      const now = Date.now();
      if (!force && now - lastStatsAt < 500) return;
      lastStatsAt = now;
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

      const serviceUUIDs = device.serviceUUIDs ?? [];
      const advertisesRequestedService =
        !!matchServiceUuid && serviceUUIDs.some((uuid) => uuid.toLowerCase() === matchServiceUuid.toLowerCase());
      const name = device.name ?? device.localName ?? (advertisesRequestedService ? `WQMPAIR_${device.id.slice(-4)}` : '');
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
        serviceUUIDs,
      };
      const shouldUpdateSeen =
        !existing ||
        seenDevice.name !== existing.name ||
        Math.abs(seenDevice.rssi - existing.rssi) >= 5 ||
        seenDevice.rssi > existing.rssi;
      if (shouldUpdateSeen) {
        nearbyDevices.set(device.id, seenDevice);
        if (!existing || seenDevice.name !== existing.name) {
          console.log(
            `[AquaNode][BLE_SCAN] Seen name="${name}" id=${device.id} rssi=${seenDevice.rssi} services=${serviceUUIDs.join(',') || 'none'}`,
          );
        }
        emitStats();
      }

      if (!namePrefixes.some((prefix) => name.startsWith(prefix)) && !advertisesRequestedService) return;
      matchedAdvertisements += 1;
      if (!existing) console.log(`[AquaNode][BLE_SCAN] Matched AquaNode device name="${name}" id=${device.id} rssi=${device.rssi ?? -100}`);
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
    let device = await manager.connectToDevice(deviceId, { timeout: 12_000 });
    if (typeof device.requestMTU === 'function') {
      try {
        device = await device.requestMTU(517);
        console.log('[BLE] MTU requested:', device.mtu ?? 517);
      } catch (mtuError) {
        console.log('[BLE] MTU request failed, continuing with default MTU', mtuError);
      }
    }
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

export async function writeJson(
  device: Device,
  serviceUuid: string,
  characteristicUuid: string,
  command: unknown,
  options?: { repeatWithoutResponseAfterSuccess?: boolean; preferWithoutResponse?: boolean },
): Promise<void> {
  const commandJson = JSON.stringify(command);
  const encoded = encodeBleCommand(command);
  if (options?.preferWithoutResponse) {
    try {
      console.log('[BLE TX->RX] Sending command without response:', commandJson);
      await device.writeCharacteristicWithoutResponseForService(serviceUuid, characteristicUuid, encoded);
      console.log('[BLE TX->RX] Write without response succeeded');
      return;
    } catch (error) {
      console.warn('[BLE TX->RX] Write without response failed, retrying with response:', error);
      try {
        const stillConnected = await device.isConnected();
        if (!stillConnected) throw new Error('Device disconnected before write-with-response retry.');
        await device.writeCharacteristicWithResponseForService(serviceUuid, characteristicUuid, encoded);
        console.log('[BLE TX->RX] Write with response retry succeeded');
        return;
      } catch (retryError) {
        throw new Error(baseBleErrorMessage(retryError));
      }
    }
  }

  try {
    console.log('[BLE TX->RX] Sending command:', commandJson);
    await device.writeCharacteristicWithResponseForService(serviceUuid, characteristicUuid, encoded);
    console.log('[BLE TX->RX] Write with response succeeded');
    if (options?.repeatWithoutResponseAfterSuccess) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      try {
        const stillConnected = await device.isConnected();
        if (!stillConnected) {
          console.log('[BLE TX->RX] Skipping repeat without response because device disconnected:', commandJson);
          return;
        }
        console.log('[BLE TX->RX] Repeating command without response:', commandJson);
        await device.writeCharacteristicWithoutResponseForService(serviceUuid, characteristicUuid, encoded);
        console.log('[BLE TX->RX] Repeat without response succeeded');
      } catch (repeatError) {
        console.warn('[BLE TX->RX] Repeat without response failed after successful write; continuing:', repeatError);
      }
    }
  } catch (error) {
    console.warn('[BLE TX->RX] Write with response failed, retrying without response:', error);
    try {
      const stillConnected = await device.isConnected();
      if (!stillConnected) throw new Error('Device disconnected before write-without-response retry.');
      await device.writeCharacteristicWithoutResponseForService(serviceUuid, characteristicUuid, encoded);
      console.log('[BLE TX->RX] Write without response succeeded');
    } catch (retryError) {
      throw new Error(baseBleErrorMessage(retryError));
    }
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
  let pendingDecoded = '';
  let lastParentsLogAt = 0;
  const parseAndEmit = (decoded: string): boolean => {
    const normalized = decoded.trim();
    try {
      const value = JSON.parse(normalized) as T;
      console.log('[BLE JSON]', value);
      onDebug?.({ lastDecodedResponse: normalized });
      callback(value);
      return true;
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      if (message.toLowerCase().includes('end of input')) {
        console.log('[BLE JSON PARTIAL]', normalized);
      } else {
        console.warn('[BLE JSON ERROR]', normalized, parseError);
        onDebug?.({ lastError: message });
      }
      return false;
    }
  };
  const extractJsonMessages = (buffer: string): { messages: string[]; rest: string } => {
    const messages: string[] = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < buffer.length; index += 1) {
      const char = buffer[index];
      if (start < 0) {
        if (char === '{' || char === '[') {
          start = index;
          depth = 1;
          inString = false;
          escaped = false;
        }
        continue;
      }

      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = inString;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === '{' || char === '[') depth += 1;
      if (char === '}' || char === ']') depth -= 1;

      if (depth === 0) {
        messages.push(buffer.slice(start, index + 1));
        start = -1;
      }
    }

    return { messages, rest: start >= 0 ? buffer.slice(start) : '' };
  };
  const looksLikeNewTopLevelMessage = (decoded: string): boolean =>
    decoded.trim().startsWith('{"type":') || decoded.trim().startsWith('{"cmd":') || decoded.trim().startsWith('{"t":');
  const notificationTypeOf = (decoded: string): string | null => {
    const match = decoded.trim().match(/^\{"(?:type|cmd|t)":"([^"]+)"/);
    return match?.[1] ?? null;
  };

  return device.monitorCharacteristicForService(serviceUuid, characteristicUuid, (error, characteristic) => {
    if (error) {
      const message = baseBleErrorMessage(error);
      console.warn('[BLE JSON ERROR]', 'monitor error', error);
      onDebug?.({ lastError: message });
      onError?.(message);
      return;
    }
    const raw = characteristic?.value ?? '';
    const decoded = decodeBleText(raw)?.trim();
    const isParentsPacket = decoded?.includes('"type":"parents"') || decoded?.includes('"type": "parents"');
    const now = Date.now();
    const shouldLogPacket = !isParentsPacket || now - lastParentsLogAt > 3000;
    if (shouldLogPacket) {
      if (isParentsPacket) lastParentsLogAt = now;
      console.log('[BLE RX<-TX] Raw base64:', raw);
      console.log('[BLE RX<-TX] Decoded:', decoded ?? '');
      onDebug?.({ lastRawResponse: raw, lastDecodedResponse: decoded ?? undefined });
    }
    if (!decoded) return;

    if (pendingDecoded && looksLikeNewTopLevelMessage(decoded) && looksLikeNewTopLevelMessage(pendingDecoded)) {
      const pendingType = notificationTypeOf(pendingDecoded);
      const decodedType = notificationTypeOf(decoded);
      if (pendingType === 'wifi_scan' && decodedType === 'parents') {
        console.log('[BLE JSON PARTIAL] Ignoring interleaved parents notification while assembling wifi_scan');
        return;
      }
      if (pendingDecoded !== decoded) {
        console.warn('[BLE JSON ERROR] Dropping incomplete notification before new top-level message:', pendingDecoded);
        onDebug?.({ lastError: 'Dropping incomplete notification before new top-level message' });
        pendingDecoded = '';
      }
    }

    pendingDecoded += decoded;
    const { messages, rest } = extractJsonMessages(pendingDecoded);
    messages.forEach((message) => {
      parseAndEmit(message);
    });
    pendingDecoded = rest;

    if (pendingDecoded) {
      console.log('[BLE JSON PARTIAL]', pendingDecoded.trim());
    }

    if (pendingDecoded.length > 8192) {
      console.warn('[BLE JSON ERROR] Dropping oversized partial notification buffer');
      onDebug?.({ lastError: 'Dropping oversized partial notification buffer' });
      pendingDecoded = '';
    }
  });
}
