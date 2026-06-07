import { onValue, ref, type Unsubscribe } from 'firebase/database';
import type { NetworkDevice } from '../../types/networkDevice';
import { buildNetworkDevice, safeKey } from '../../utils/pairingUtils';
import { getFirebaseDb } from './firebaseClient';

export function subscribeNetworkDevices(
  networkId: string,
  callback: (devices: NetworkDevice[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) {
    callback([]);
    onError?.('Firebase is not configured.');
    return () => {};
  }

  return onValue(
    ref(db, `networks/${safeKey(networkId)}/devices`),
    (snap) => {
      const raw = snap.val() as Record<string, unknown> | null;
      const devices = Object.entries(raw ?? {})
        .map(([key, value]) => buildNetworkDevice(key, value))
        .sort((a, b) => a.displayRole.localeCompare(b.displayRole) || a.id.localeCompare(b.id));
      callback(devices);
    },
    (error) => onError?.(error.message),
  );
}

export function subscribeDeviceLatest(
  networkId: string,
  deviceId: string,
  callback: (latest: unknown) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(
    ref(db, `networks/${safeKey(networkId)}/devices/${safeKey(deviceId)}/latest`),
    (snap) => callback(snap.val()),
    (error) => onError?.(error.message),
  );
}

export function subscribeDeviceStatus(
  networkId: string,
  deviceId: string,
  callback: (status: unknown) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(
    ref(db, `networks/${safeKey(networkId)}/devices/${safeKey(deviceId)}/status`),
    (snap) => callback(snap.val()),
    (error) => onError?.(error.message),
  );
}

export function subscribeGatewayChildren(
  networkId: string,
  gatewayId: string,
  callback: (children: Record<string, unknown>) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(
    ref(db, `networks/${safeKey(networkId)}/gateways/${safeKey(gatewayId)}/children`),
    (snap) => callback((snap.val() as Record<string, unknown> | null) ?? {}),
    (error) => onError?.(error.message),
  );
}

