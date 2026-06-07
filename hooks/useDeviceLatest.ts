import { useEffect, useMemo, useState } from 'react';
import type { DeviceLatest, DeviceStatus } from '../types/networkDevice';
import { subscribeDeviceLatest, subscribeDeviceStatus, subscribeGatewayChildren } from '../services/firebase/deviceService';
import { normalizeDeviceLatest, normalizeStatus } from '../utils/pairingUtils';

export function useDeviceLatest(networkId: string, deviceId: string) {
  const [latest, setLatest] = useState<DeviceLatest | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [children, setChildren] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const unsubs = [
      subscribeDeviceLatest(networkId, deviceId, (value) => setLatest(normalizeDeviceLatest(value)), setError),
      subscribeDeviceStatus(networkId, deviceId, (value) => setStatus(normalizeStatus(value)), setError),
      subscribeGatewayChildren(networkId, deviceId, setChildren, setError),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [networkId, deviceId]);

  const directChildren = useMemo(() => Object.keys(children), [children]);
  return { latest, status, children, directChildren, error };
}

