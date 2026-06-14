import { onValue, ref, type Unsubscribe } from 'firebase/database';
import type { NetworkDevice } from '../../types/networkDevice';
import { buildNetworkDevice, safeKey } from '../../utils/pairingUtils';
import { getFirebaseDb } from './firebaseClient';

function buildDevices(
  devicesRaw: Record<string, unknown>,
  pairingRaw: Record<string, unknown>,
): NetworkDevice[] {
  const merged = new Map<string, NetworkDevice>();
  Object.entries(pairingRaw).forEach(([key, value]) => {
    merged.set(key, buildNetworkDevice(key, value));
  });
  Object.entries(devicesRaw).forEach(([key, value]) => {
    merged.set(key, buildNetworkDevice(key, value));
  });
  return Array.from(merged.values()).sort((a, b) => a.displayRole.localeCompare(b.displayRole) || a.id.localeCompare(b.id));
}

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

  let devicesRaw: Record<string, unknown> = {};
  let pairingRaw: Record<string, unknown> = {};
  const emit = () => callback(buildDevices(devicesRaw, pairingRaw));

  const unsubDevices = onValue(
    ref(db, `networks/${safeKey(networkId)}/devices`),
    (snap) => {
      devicesRaw = (snap.val() as Record<string, unknown> | null) ?? {};
      emit();
    },
    (error) => onError?.(error.message),
  );
  const unsubPairing = onValue(
    ref(db, `networks/${safeKey(networkId)}/pairingRequests`),
    (snap) => {
      pairingRaw = (snap.val() as Record<string, unknown> | null) ?? {};
      emit();
    },
    (error) => onError?.(error.message),
  );

  return () => {
    unsubDevices();
    unsubPairing();
  };
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

export function subscribeDevicePairingRequest(
  networkId: string,
  deviceId: string,
  callback: (status: unknown) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(
    ref(db, `networks/${safeKey(networkId)}/pairingRequests/${safeKey(deviceId)}`),
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
