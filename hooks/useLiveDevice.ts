import { useCallback, useEffect, useState } from 'react';
import type { AquaDevice } from '../types/device';
import type { FirebaseDeviceSnapshot, FirebaseDeviceStatus, FirebaseLatestReading } from '../types/firebase';
import {
  getDeviceOnce,
  mapFirebaseDeviceToAquaDevice,
  subscribeToDevice,
} from '../services/firebase/deviceTelemetryService';
import { getFirebaseDb } from '../services/firebase/firebaseClient';
import { isFirebaseConfigured } from '../constants/env';

export interface UseLiveDeviceResult {
  device: AquaDevice | null;
  latest: FirebaseLatestReading | null;
  status: FirebaseDeviceStatus | null;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  refresh: () => Promise<void>;
}

function firebaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code);
    if (code === 'PERMISSION_DENIED') {
      return 'Firebase rules or auth blocked access (PERMISSION_DENIED).';
    }
    return `Firebase error: ${code}`;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export function useLiveDevice(deviceId: string | undefined, firebaseRtdbConnected = true): UseLiveDeviceResult {
  const [snapshot, setSnapshot] = useState<FirebaseDeviceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      setSnapshot(null);
      setError(null);
      return;
    }

    if (!isFirebaseConfigured() || !getFirebaseDb()) {
      setLoading(false);
      setSnapshot(null);
      setError('Firebase is not configured.');
      return;
    }

    setLoading(true);
    setError(null);

    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToDevice(deviceId, (snap) => {
        setSnapshot(snap);
        setLoading(false);
        setError(null);
      });
    } catch (e) {
      setError(firebaseErrorMessage(e));
      setLoading(false);
    }

    return () => {
      unsub?.();
    };
  }, [deviceId]);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    if (!isFirebaseConfigured() || !getFirebaseDb()) {
      setError('Firebase is not configured.');
      return;
    }
    try {
      const snap = await getDeviceOnce(deviceId);
      setSnapshot(snap);
      setError(null);
    } catch (e) {
      setError(firebaseErrorMessage(e));
    }
  }, [deviceId]);

  const device =
    snapshot && deviceId
      ? mapFirebaseDeviceToAquaDevice(deviceId, snapshot.latest, snapshot.status, snapshot.receivedAt, firebaseRtdbConnected)
      : null;

  return {
    device,
    latest: snapshot?.latest ?? null,
    status: snapshot?.status ?? null,
    loading,
    error,
    lastUpdatedAt: snapshot?.receivedAt ?? null,
    refresh,
  };
}
