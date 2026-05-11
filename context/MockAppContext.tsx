import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AquaAlert } from '../types/alert';
import type { AquaDevice } from '../types/device';
import type { Pond } from '../types/pond';
import type { SensorThresholds } from '../types/sensor';
import {
  mockAlerts as seedAlerts,
  mockDevices as seedDevices,
  mockPonds as seedPonds,
  mockThresholds as seedThresholds,
  mockUser,
} from '../constants/mockData';

const KEYS = {
  onboarded: '@aquanode/hasCompletedOnboarding',
  session: '@aquanode/mockLoggedIn',
};

export type TempUnit = 'C' | 'F';
export type TdsUnit = 'ppm' | 'ec';
export type AppThemePref = 'light' | 'system';

interface MockAppState {
  user: typeof mockUser;
  ponds: Pond[];
  devices: AquaDevice[];
  alerts: AquaAlert[];
  thresholds: SensorThresholds;
  tempUnit: TempUnit;
  tdsUnit: TdsUnit;
  themePref: AppThemePref;
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  mockLoggedIn: boolean;
  hydrated: boolean;
}

interface MockAppContextValue extends MockAppState {
  setHasCompletedOnboarding: (v: boolean) => Promise<void>;
  setMockLoggedIn: (v: boolean) => Promise<void>;
  markAlertResolved: (id: string) => void;
  setThresholds: (t: Partial<SensorThresholds>) => void;
  setTempUnit: (u: TempUnit) => void;
  setTdsUnit: (u: TdsUnit) => void;
  setThemePref: (t: AppThemePref) => void;
  setNotificationsEnabled: (v: boolean) => void;
  addPond: (p: Omit<Pond, 'id'>) => void;
  logout: () => Promise<void>;
}

const MockAppContext = createContext<MockAppContextValue | null>(null);

export function MockAppProvider({ children }: { children: React.ReactNode }) {
  const [ponds, setPonds] = useState<Pond[]>(seedPonds);
  const [devices] = useState<AquaDevice[]>(seedDevices);
  const [alerts, setAlerts] = useState<AquaAlert[]>(seedAlerts);
  const [thresholds, setThresholdsState] = useState<SensorThresholds>(seedThresholds);
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  const [tdsUnit, setTdsUnit] = useState<TdsUnit>('ppm');
  const [themePref, setThemePref] = useState<AppThemePref>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState(false);
  const [mockLoggedIn, setMockLoggedInState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, s] = await Promise.all([
          AsyncStorage.getItem(KEYS.onboarded),
          AsyncStorage.getItem(KEYS.session),
        ]);
        if (!cancelled) {
          setHasCompletedOnboardingState(o === '1');
          setMockLoggedInState(s === '1');
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setHasCompletedOnboarding = useCallback(async (v: boolean) => {
    setHasCompletedOnboardingState(v);
    await AsyncStorage.setItem(KEYS.onboarded, v ? '1' : '0');
  }, []);

  const setMockLoggedIn = useCallback(async (v: boolean) => {
    setMockLoggedInState(v);
    await AsyncStorage.setItem(KEYS.session, v ? '1' : '0');
  }, []);

  const markAlertResolved = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
  }, []);

  const setThresholds = useCallback((t: Partial<SensorThresholds>) => {
    setThresholdsState((prev) => ({ ...prev, ...t }));
  }, []);

  const addPond = useCallback((p: Omit<Pond, 'id'>) => {
    const id = `pond-${Date.now()}`;
    setPonds((prev) => [...prev, { ...p, id }]);
  }, []);

  const logout = useCallback(async () => {
    await setMockLoggedIn(false);
  }, [setMockLoggedIn]);

  const value = useMemo<MockAppContextValue>(
    () => ({
      user: mockUser,
      ponds,
      devices,
      alerts,
      thresholds,
      tempUnit,
      tdsUnit,
      themePref,
      notificationsEnabled,
      hasCompletedOnboarding,
      mockLoggedIn,
      hydrated,
      setHasCompletedOnboarding,
      setMockLoggedIn,
      markAlertResolved,
      setThresholds,
      setTempUnit,
      setTdsUnit,
      setThemePref,
      setNotificationsEnabled,
      addPond,
      logout,
    }),
    [
      ponds,
      devices,
      alerts,
      thresholds,
      tempUnit,
      tdsUnit,
      themePref,
      notificationsEnabled,
      hasCompletedOnboarding,
      mockLoggedIn,
      hydrated,
      setHasCompletedOnboarding,
      setMockLoggedIn,
      markAlertResolved,
      setThresholds,
      addPond,
      logout,
    ],
  );

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>;
}

export function useMockApp() {
  const ctx = useContext(MockAppContext);
  if (!ctx) throw new Error('useMockApp must be used within MockAppProvider');
  return ctx;
}
