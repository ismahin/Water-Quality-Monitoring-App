import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PairingParent, PairingProgressState, PairingWizardStep } from '../types/pairing';
import { subscribeDevicePairingTest, subscribePairingTest } from '../services/firebase/pairingTestService';
import { DEFAULT_NETWORK_ID, filterCompatibleParents } from '../utils/pairingUtils';
import { LAST_NETWORK_ID_KEY } from './useDevices';
import { usePairingBle } from './usePairingBle';

const initialProgress: PairingProgressState = {
  bleConnected: false,
  infoLoaded: false,
  identitySaved: false,
  roleSelected: false,
  parentSelected: false,
  pairStarted: false,
  pairSaved: false,
  serverTestSent: false,
  serverTestConfirmed: false,
};

export function usePairingWizard() {
  const ble = usePairingBle();
  const [step, setStep] = useState<PairingWizardStep>('instructions');
  const [deviceId, setDeviceId] = useState('C1');
  const [networkId, setNetworkId] = useState(DEFAULT_NETWORK_ID);
  const [role, setRole] = useState<'CHILD' | 'RELAY'>('CHILD');
  const [selectedParent, setSelectedParent] = useState<PairingParent | null>(null);
  const [progress, setProgress] = useState<PairingProgressState>(initialProgress);
  const [testId, setTestId] = useState<string | null>(null);
  const [serverTestTimedOut, setServerTestTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(LAST_NETWORK_ID_KEY).then((stored) => {
      if (!cancelled && stored) setNetworkId(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ble.info) return;
    setDeviceId(ble.info.device_id || deviceId);
    setNetworkId(ble.info.network_id || networkId);
    setProgress((prev) => ({ ...prev, bleConnected: true, infoLoaded: true }));
  }, [ble.info]);

  useEffect(() => {
    const latest = ble.notifications[0];
    if (!latest) return;
    if (latest.type === 'set_id' && latest.ok) {
      setProgress((prev) => ({ ...prev, identitySaved: true }));
    }
    if (latest.type === 'pair_started') {
      const ok = latest.ok === true;
      setProgress((prev) => ({ ...prev, pairStarted: ok, error: ok ? undefined : latest.message }));
    }
    if (latest.type === 'pair_result') {
      const ok = latest.ok === true;
      setProgress((prev) => ({
        ...prev,
        pairSaved: ok,
        error: ok ? undefined : latest.message ?? 'Parent rejected pairing.',
      }));
    }
    if (latest.type === 'server_test' && typeof latest.test_id === 'string') {
      setTestId(latest.test_id);
      setStep('test');
      setProgress((prev) => ({ ...prev, serverTestSent: true }));
    }
  }, [ble.notifications]);

  useEffect(() => {
    if (!testId) return;
    setServerTestTimedOut(false);
    const unsubs = [
      subscribePairingTest(networkId, testId, (test) => {
        if (test) {
          setProgress((prev) => ({ ...prev, serverTestConfirmed: true }));
          setStep('done');
        }
      }, ble.setError),
      subscribeDevicePairingTest(networkId, deviceId, (test) => {
        if (test) {
          setProgress((prev) => ({ ...prev, serverTestConfirmed: true }));
          setStep('done');
        }
      }, ble.setError),
    ];
    const timer = setTimeout(() => setServerTestTimedOut(true), 30_000);
    return () => {
      clearTimeout(timer);
      unsubs.forEach((unsub) => unsub());
    };
  }, [testId, networkId, deviceId, ble.setError]);

  const compatibleParents = useMemo(
    () => filterCompatibleParents(ble.parents, networkId, deviceId),
    [ble.parents, networkId, deviceId],
  );

  const saveIdentity = useCallback(async () => {
    await AsyncStorage.setItem(LAST_NETWORK_ID_KEY, networkId);
    await ble.actions.setIdentity(deviceId, networkId);
  }, [ble.actions, deviceId, networkId]);

  const selectParent = useCallback((parent: PairingParent) => {
    setSelectedParent(parent);
    setProgress((prev) => ({ ...prev, parentSelected: true }));
  }, []);

  const pair = useCallback(async () => {
    if (!selectedParent) return;
    setStep('connect');
    await ble.actions.startPairing(selectedParent.id, role, networkId);
  }, [ble.actions, networkId, role, selectedParent]);

  const selectRole = useCallback((nextRole: 'CHILD' | 'RELAY') => {
    setRole(nextRole);
    setProgress((prev) => ({ ...prev, roleSelected: true }));
  }, []);

  const retryParents = useCallback(async () => {
    setStep('parent');
    await ble.actions.scanParents();
  }, [ble.actions]);

  const finishAnyway = useCallback(() => {
    setStep('done');
  }, []);

  return {
    ...ble,
    step,
    setStep,
    deviceId,
    setDeviceId,
    networkId,
    setNetworkId,
    role,
    setRole: selectRole,
    selectedParent,
    selectParent,
    progress,
    testId,
    serverTestTimedOut,
    compatibleParents,
    saveIdentity,
    pair,
    retryParents,
    finishAnyway,
  };
}
