import Constants from 'expo-constants';
import type { BleManager as BleManagerType } from 'react-native-ble-plx';
import { MOCK_BLE_CONFIG_ENV } from '../../constants/env';

declare const require: (name: string) => unknown;

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

type BlePlxModule = typeof import('react-native-ble-plx');

let blePlxModule: BlePlxModule | null = null;
let manager: BleManagerType | null = null;

function getBlePlx(): BlePlxModule {
  if (MOCK_BLE_CONFIG) {
    throw new BleConfigError('EXPO_GO_UNSUPPORTED', 'BLE is mocked in Expo Go or when EXPO_PUBLIC_MOCK_BLE_CONFIG=true.');
  }
  if (!blePlxModule) {
    try {
      blePlxModule = require('react-native-ble-plx') as BlePlxModule;
    } catch (error) {
      throw new BleConfigError(
        'EXPO_GO_UNSUPPORTED',
        'BLE requires an Android/iOS build with react-native-ble-plx.',
        error,
      );
    }
  }
  return blePlxModule;
}

export function getSharedBleManager(): BleManagerType {
  if (!manager) {
    try {
      const mod = getBlePlx();
      manager = new mod.BleManager();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.toLowerCase().includes('createclient') || text.toLowerCase().includes('null')) {
        throw new BleConfigError(
          'EXPO_GO_UNSUPPORTED',
          'BLE scanning requires an Android build that includes react-native-ble-plx. Rebuild and reinstall the app, then try again.',
          error,
        );
      }
      throw error;
    }
  }
  return manager;
}

