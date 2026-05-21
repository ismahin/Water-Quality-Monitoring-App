import Constants from 'expo-constants';
import type { Characteristic, Device, BleManager as BleManagerType, Subscription } from 'react-native-ble-plx';
import type { BleConfigResponse, UniversalDeviceConfig } from '../../types/universalDevice';
import { MOCK_BLE_CONFIG_ENV } from '../../constants/env';

declare const require: (name: string) => unknown;

export const BLE_CONFIG_SERVICE_UUID = '7b7d0001-8e8f-4f6a-9c2a-001122334455';
export const BLE_CONFIG_COMMAND_UUID = '7b7d0002-8e8f-4f6a-9c2a-001122334455';
export const BLE_CONFIG_RESPONSE_UUID = '7b7d0003-8e8f-4f6a-9c2a-001122334455';
export const BLE_CONFIG_STATUS_UUID = '7b7d0004-8e8f-4f6a-9c2a-001122334455';

const SCAN_MS = 6000;
const CONNECT_TIMEOUT_MS = 12000;
const RESPONSE_TIMEOUT_MS = 4000;

export const MOCK_BLE_CONFIG = MOCK_BLE_CONFIG_ENV || Constants.appOwnership === 'expo';

export type BleConfigErrorCode =
  | 'PERMISSION_DENIED'
  | 'BLUETOOTH_OFF'
  | 'EXPO_GO_UNSUPPORTED'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_TIMEOUT'
  | 'WRITE_FAILED'
  | 'RESPONSE_TIMEOUT'
  | 'INVALID_JSON_RESPONSE'
  | 'UNKNOWN_ERROR';

export class BleConfigError extends Error {
  constructor(
    public code: BleConfigErrorCode,
    message: string,
    public rawError?: unknown,
  ) {
    super(message);
    this.name = 'BleConfigError';
  }
}

export interface ConfigScanItem {
  id: string;
  name: string;
  rssi: number;
  transport: 'ble-config';
}

type BlePlxModule = typeof import('react-native-ble-plx');

let blePlxModule: BlePlxModule | null = null;
let manager: BleManagerType | null = null;
let currentDevice: Device | null = null;
let mockConfig: UniversalDeviceConfig = {
  deviceId: 'M1',
  networkId: 'POND_001',
  parentId: '',
  rootGatewayId: 'M1',
  gatewayUplinkEnabled: true,
  relayEnabled: false,
  sampleIntervalMs: 10000,
};

function getBlePlx(): BlePlxModule {
  if (MOCK_BLE_CONFIG) {
    throw new BleConfigError('EXPO_GO_UNSUPPORTED', 'BLE config is mocked in Expo Go or when EXPO_PUBLIC_MOCK_BLE_CONFIG=true.');
  }
  if (!blePlxModule) {
    try {
      blePlxModule = require('react-native-ble-plx') as BlePlxModule;
    } catch (error) {
      throw new BleConfigError(
        'EXPO_GO_UNSUPPORTED',
        'BLE config requires a development build with react-native-ble-plx.',
        error,
      );
    }
  }
  return blePlxModule;
}

function getManager(): BleManagerType {
  if (!manager) {
    const mod = getBlePlx();
    manager = new mod.BleManager();
  }
  return manager;
}

function normalizeBleError(error: unknown, fallback: BleConfigErrorCode): BleConfigError {
  if (error instanceof BleConfigError) return error;
  const text =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error);
  const low = text.toLowerCase();
  if (low.includes('permission') || low.includes('denied')) {
    return new BleConfigError('PERMISSION_DENIED', 'Bluetooth permission was denied.', error);
  }
  if (low.includes('poweredoff') || low.includes('powered off') || low.includes('bluetooth') && low.includes('off')) {
    return new BleConfigError('BLUETOOTH_OFF', 'Bluetooth is turned off.', error);
  }
  if (low.includes('timeout')) {
    return new BleConfigError('CONNECTION_TIMEOUT', 'BLE connection timed out.', error);
  }
  if (low.includes('not found')) {
    return new BleConfigError('DEVICE_NOT_FOUND', 'BLE config device was not found.', error);
  }
  return new BleConfigError(fallback, text || 'BLE config failed.', error);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: BleConfigErrorCode, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      void promise.catch(() => undefined);
      reject(new BleConfigError(code, message));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function utf8ToBinary(value: string): string {
  return encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function binaryToUtf8(value: string): string {
  return decodeURIComponent(
    value
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
}

export function encodeBleJson(json: unknown): string {
  const text = typeof json === 'string' ? json : JSON.stringify(json);
  return btoa(utf8ToBinary(text));
}

export function decodeBleJson<T = unknown>(base64Value?: string | null): T {
  if (!base64Value) {
    throw new BleConfigError('INVALID_JSON_RESPONSE', 'BLE response was empty.');
  }
  try {
    return JSON.parse(binaryToUtf8(atob(base64Value))) as T;
  } catch (error) {
    throw new BleConfigError('INVALID_JSON_RESPONSE', 'BLE response was not valid JSON.', error);
  }
}

export function parseDeviceIdFromConfigName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith('CFG_')) return trimmed.slice(4);
  return trimmed;
}

function mockRole(): string {
  if (mockConfig.gatewayUplinkEnabled) return 'GATEWAY';
  if (mockConfig.relayEnabled) return 'RELAY';
  return mockConfig.parentId ? 'CHILD' : 'SINGLE';
}

function mockResponseFor(commandJson: Record<string, unknown>): BleConfigResponse {
  const cmd = String(commandJson.cmd ?? '');
  if (cmd === 'GET_CONFIG') return { ok: true, cmd, config: mockConfig, raw: { ...mockConfig } };
  if (cmd === 'GET_STATUS') {
    return {
      ok: true,
      cmd,
      raw: {
        device_id: mockConfig.deviceId,
        role: mockRole(),
        hardware_mode: mockConfig.gatewayUplinkEnabled || mockConfig.relayEnabled || mockConfig.parentId ? 'NETWORK' : 'SINGLE',
        gateway_uplink_enabled: mockConfig.gatewayUplinkEnabled,
        relay_enabled: mockConfig.relayEnabled,
        network_id: mockConfig.networkId,
        parent_id: mockConfig.parentId,
        root_gateway_id: mockConfig.rootGatewayId,
        lora_ready: true,
        lora_error: 'none',
        ble_config_connected: true,
      },
    };
  }
  if (cmd === 'SET_CONFIG') {
    mockConfig = {
      deviceId: String(commandJson.deviceId ?? mockConfig.deviceId),
      networkId: String(commandJson.networkId ?? mockConfig.networkId),
      parentId: String(commandJson.parentId ?? ''),
      rootGatewayId: String(commandJson.rootGatewayId ?? commandJson.deviceId ?? mockConfig.rootGatewayId),
      gatewayUplinkEnabled: commandJson.gatewayUplinkEnabled === true,
      relayEnabled: commandJson.relayEnabled === true,
      sampleIntervalMs: Number(commandJson.sampleIntervalMs ?? mockConfig.sampleIntervalMs) || 10000,
    };
    return { ok: true, cmd, config: mockConfig, message: 'Mock config saved.' };
  }
  if (cmd === 'SET_RELAY_ENABLED') {
    mockConfig = { ...mockConfig, relayEnabled: commandJson.relayEnabled === true };
    return { ok: true, cmd, config: mockConfig, message: 'Mock relay setting saved.' };
  }
  if (cmd === 'SET_GATEWAY_UPLINK') {
    mockConfig = { ...mockConfig, gatewayUplinkEnabled: commandJson.gatewayUplinkEnabled === true };
    return { ok: true, cmd, config: mockConfig, message: 'Mock gateway uplink setting saved.' };
  }
  return { ok: false, cmd, error: `Unsupported command: ${cmd}` };
}

export async function scanConfigDevices(prefix = 'CFG_'): Promise<ConfigScanItem[]> {
  if (MOCK_BLE_CONFIG) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const mockItems: ConfigScanItem[] = [
      { id: 'mock-cfg-m1', name: 'CFG_M1', rssi: -52, transport: 'ble-config' },
      { id: 'mock-cfg-c1', name: 'CFG_C1', rssi: -67, transport: 'ble-config' },
      { id: 'mock-cfg-c2', name: 'CFG_C2', rssi: -74, transport: 'ble-config' },
    ];
    return mockItems.filter((d) => d.name.startsWith(prefix));
  }

  const ble = getManager();
  try {
    const state = await ble.state();
    if (state !== 'PoweredOn') {
      throw new BleConfigError('BLUETOOTH_OFF', 'Bluetooth is turned off.');
    }

    const found = new Map<string, ConfigScanItem>();
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        try {
          ble.stopDeviceScan();
        } catch {
          /* noop */
        }
        resolve();
      };
      const timer = setTimeout(done, SCAN_MS);
      ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          clearTimeout(timer);
          try {
            ble.stopDeviceScan();
          } catch {
            /* noop */
          }
          reject(normalizeBleError(error, 'UNKNOWN_ERROR'));
          return;
        }
        const name = device?.name ?? device?.localName ?? '';
        if (!device || !name.startsWith(prefix)) return;
        const key = device.id || name;
        const item = { id: device.id, name, rssi: device.rssi ?? -100, transport: 'ble-config' as const };
        const prev = found.get(key);
        if (!prev || item.rssi > prev.rssi) found.set(key, item);
      });
    });
    return Array.from(found.values()).sort((a, b) => b.rssi - a.rssi);
  } catch (error) {
    throw normalizeBleError(error, 'UNKNOWN_ERROR');
  }
}

export async function connectConfigDevice(deviceIdOrName: string): Promise<{ deviceId: string; name: string }> {
  const target = deviceIdOrName.trim();
  if (MOCK_BLE_CONFIG) {
    mockConfig = { ...mockConfig, deviceId: parseDeviceIdFromConfigName(target || mockConfig.deviceId) };
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { deviceId: mockConfig.deviceId, name: target.startsWith('CFG_') ? target : `CFG_${mockConfig.deviceId}` };
  }

  const ble = getManager();
  try {
    let targetId = target;
    let targetName = target;
    if (target.startsWith('CFG_') || !target.includes('-')) {
      const found = await scanConfigDevices('CFG_');
      const match = found.find((d) => d.id === target || d.name === target || parseDeviceIdFromConfigName(d.name) === target);
      if (!match) throw new BleConfigError('DEVICE_NOT_FOUND', `Could not find ${target || 'CFG_ device'} nearby.`);
      targetId = match.id;
      targetName = match.name;
    }
    const connected = await withTimeout(
      ble.connectToDevice(targetId, { timeout: CONNECT_TIMEOUT_MS }),
      CONNECT_TIMEOUT_MS,
      'CONNECTION_TIMEOUT',
      'BLE config connection timed out.',
    );
    currentDevice = await connected.discoverAllServicesAndCharacteristics();
    return { deviceId: parseDeviceIdFromConfigName(targetName), name: targetName };
  } catch (error) {
    throw normalizeBleError(error, 'CONNECTION_TIMEOUT');
  }
}

export async function disconnectConfigDevice(): Promise<void> {
  if (MOCK_BLE_CONFIG) return;
  const d = currentDevice;
  currentDevice = null;
  if (!d) return;
  try {
    await d.cancelConnection();
  } catch {
    /* noop */
  }
}

async function waitForResponse(device: Device): Promise<BleConfigResponse> {
  let sub: Subscription | undefined;
  const notifyPromise = new Promise<BleConfigResponse>((resolve, reject) => {
    sub = device.monitorCharacteristicForService(
      BLE_CONFIG_SERVICE_UUID,
      BLE_CONFIG_RESPONSE_UUID,
      (error, characteristic) => {
        if (error) {
          reject(normalizeBleError(error, 'RESPONSE_TIMEOUT'));
          return;
        }
        try {
          resolve(decodeBleJson<BleConfigResponse>(characteristic?.value));
        } catch (decodeError) {
          reject(decodeError);
        }
      },
    );
  });

  try {
    return await withTimeout(notifyPromise, RESPONSE_TIMEOUT_MS, 'RESPONSE_TIMEOUT', 'BLE config response timed out.');
  } catch (error) {
    if (error instanceof BleConfigError && error.code === 'RESPONSE_TIMEOUT') {
      const read = await device.readCharacteristicForService(BLE_CONFIG_SERVICE_UUID, BLE_CONFIG_RESPONSE_UUID);
      return decodeBleJson<BleConfigResponse>(read.value);
    }
    throw error;
  } finally {
    sub?.remove();
  }
}

export async function sendConfigCommand(commandJson: Record<string, unknown>): Promise<BleConfigResponse> {
  if (MOCK_BLE_CONFIG) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockResponseFor(commandJson);
  }
  if (!currentDevice) {
    throw new BleConfigError('DEVICE_NOT_FOUND', 'No CFG_ device is connected.');
  }

  try {
    const responsePromise = waitForResponse(currentDevice);
    await currentDevice.writeCharacteristicWithResponseForService(
      BLE_CONFIG_SERVICE_UUID,
      BLE_CONFIG_COMMAND_UUID,
      encodeBleJson(commandJson),
    );
    return await responsePromise;
  } catch (error) {
    throw normalizeBleError(error, 'WRITE_FAILED');
  }
}

export function getStatus(): Promise<BleConfigResponse> {
  return sendConfigCommand({ cmd: 'GET_STATUS' });
}

export function getConfig(): Promise<BleConfigResponse> {
  return sendConfigCommand({ cmd: 'GET_CONFIG' });
}

export function setUniversalConfig(config: UniversalDeviceConfig): Promise<BleConfigResponse> {
  return sendConfigCommand({ cmd: 'SET_CONFIG', ...config });
}

export function setRelayEnabled(relayEnabled: boolean): Promise<BleConfigResponse> {
  return sendConfigCommand({ cmd: 'SET_RELAY_ENABLED', relayEnabled });
}

export function setGatewayUplink(gatewayUplinkEnabled: boolean): Promise<BleConfigResponse> {
  return sendConfigCommand({ cmd: 'SET_GATEWAY_UPLINK', gatewayUplinkEnabled });
}

export function listenStatusNotifications(callback: (value: unknown) => void): () => void {
  if (MOCK_BLE_CONFIG) {
    const timer = setInterval(() => {
      callback(mockResponseFor({ cmd: 'GET_STATUS' }).raw);
    }, 3000);
    return () => clearInterval(timer);
  }
  if (!currentDevice) {
    throw new BleConfigError('DEVICE_NOT_FOUND', 'No CFG_ device is connected.');
  }
  const sub = currentDevice.monitorCharacteristicForService(
    BLE_CONFIG_SERVICE_UUID,
    BLE_CONFIG_STATUS_UUID,
    (error: unknown, characteristic?: Characteristic | null) => {
      if (error || !characteristic?.value) return;
      try {
        callback(decodeBleJson(characteristic.value));
      } catch {
        /* Ignore malformed status notifications; command response path reports invalid JSON. */
      }
    },
  );
  return () => sub.remove();
}
