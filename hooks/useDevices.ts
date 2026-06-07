import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { NetworkDevice } from '../types/networkDevice';
import { subscribeNetworkDevices } from '../services/firebase/deviceService';
import { DEFAULT_NETWORK_ID } from '../utils/pairingUtils';

export const LAST_NETWORK_ID_KEY = '@aquanode/lastNetworkId';

export function useDevices(initialNetworkId = DEFAULT_NETWORK_ID) {
  const [networkId, setNetworkIdState] = useState(initialNetworkId);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(LAST_NETWORK_ID_KEY).then((stored) => {
      if (!cancelled && stored) setNetworkIdState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeNetworkDevices(
      networkId,
      (next) => {
        setDevices(next);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return unsub;
  }, [networkId]);

  const setNetworkId = useCallback(async (next: string) => {
    const clean = next.trim() || DEFAULT_NETWORK_ID;
    setNetworkIdState(clean);
    await AsyncStorage.setItem(LAST_NETWORK_ID_KEY, clean);
  }, []);

  return { devices, loading, error, networkId, setNetworkId };
}

