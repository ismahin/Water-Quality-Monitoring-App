import { onValue, ref, type Unsubscribe } from 'firebase/database';
import type { PairingTestRecord } from '../../types/networkDevice';
import { safeKey } from '../../utils/pairingUtils';
import { getFirebaseDb } from './firebaseClient';

export function subscribePairingTest(
  networkId: string,
  testId: string,
  callback: (test: PairingTestRecord | null) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) {
    callback(null);
    onError?.('Firebase is not configured.');
    return () => {};
  }
  return onValue(
    ref(db, `networks/${safeKey(networkId)}/pairingTests/${safeKey(testId)}`),
    (snap) => callback(snap.val() as PairingTestRecord | null),
    (error) => onError?.(error.message),
  );
}

export function subscribeDevicePairingTest(
  networkId: string,
  deviceId: string,
  callback: (test: PairingTestRecord | null) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};
  return onValue(
    ref(db, `networks/${safeKey(networkId)}/devices/${safeKey(deviceId)}/pairing_test`),
    (snap) => callback(snap.val() as PairingTestRecord | null),
    (error) => onError?.(error.message),
  );
}

