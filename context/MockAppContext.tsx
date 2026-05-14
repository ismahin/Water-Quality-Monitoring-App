import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, type Unsubscribe } from 'firebase/database';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AquaAlert } from '../types/alert';
import type { AquaDevice, GatewayDevice, SingleDevice } from '../types/device';
import type { Pond } from '../types/pond';
import type { SensorThresholds } from '../types/sensor';
import type { FirebaseDeviceSnapshot } from '../types/firebase';
import type { RegisteredDevice } from '../types/registeredDevice';
import { isFirebaseConfigured } from '../constants/env';
import {
  mockAlerts as seedAlerts,
  mockDevices as seedDevices,
  mockPonds as seedPonds,
  mockThresholds as seedThresholds,
  mockUser,
} from '../constants/mockData';
import { getFirebaseDb } from '../services/firebase/firebaseClient';
import {
  mapFirebaseDeviceToAquaDevice,
  subscribeToDevice,
} from '../services/firebase/deviceTelemetryService';

const KEYS = {
  onboarded: '@aquanode/hasCompletedOnboarding',
  session: '@aquanode/mockLoggedIn',
  registered: '@aquanode/registeredDevices',
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
  /** Session + onboarding + registered devices hydration */
  hydrated: boolean;
  registeredDevices: RegisteredDevice[];
  firebaseRtdbConnected: boolean;
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
  addRegisteredDevice: (deviceId: string, options?: { bleProvisionName?: string }) => Promise<void>;
  removeRegisteredDevice: (deviceId: string) => Promise<void>;
  getLiveDevice: (deviceId: string) => GatewayDevice | SingleDevice | null;
  getLiveSnapshot: (deviceId: string) => FirebaseDeviceSnapshot | undefined;
  isRegisteredLiveDevice: (deviceId: string) => boolean;
}

const MockAppContext = createContext<MockAppContextValue | null>(null);

function placeholderSingle(reg: RegisteredDevice, firebaseRtdbConnected: boolean): SingleDevice {
  return {
    id: reg.deviceId,
    name: reg.name,
    role: 'single',
    pondId: reg.pondId,
    online: 'offline',
    batteryPercent: 0,
    lastSeenAt: reg.provisionedAt,
    lastDataAt: reg.provisionedAt,
    sensors: { ph: 0, tdsPpm: 0, temperatureC: 0, turbidityNtu: 0 },
    calibrationStatus: 'ok',
    firmwareVersion: '1.0.0',
    wifiSsid: '—',
    wifiRssi: -100,
    cloudOnline: firebaseRtdbConnected,
  };
}

export function MockAppProvider({ children }: { children: React.ReactNode }) {
  const [pondsBase, setPonds] = useState<Pond[]>(seedPonds);
  const [alerts, setAlerts] = useState<AquaAlert[]>(seedAlerts);
  const [thresholds, setThresholdsState] = useState<SensorThresholds>(seedThresholds);
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  const [tdsUnit, setTdsUnit] = useState<TdsUnit>('ppm');
  const [themePref, setThemePref] = useState<AppThemePref>('light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState(false);
  const [mockLoggedIn, setMockLoggedInState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [hydratedRegistered, setHydratedRegistered] = useState(false);
  const [liveSnapshots, setLiveSnapshots] = useState<Record<string, FirebaseDeviceSnapshot>>({});
  const [firebaseRtdbConnected, setFirebaseRtdbConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, s, regRaw] = await Promise.all([
          AsyncStorage.getItem(KEYS.onboarded),
          AsyncStorage.getItem(KEYS.session),
          AsyncStorage.getItem(KEYS.registered),
        ]);
        if (!cancelled) {
          setHasCompletedOnboardingState(o === '1');
          setMockLoggedInState(s === '1');
          if (regRaw) {
            try {
              const parsed = JSON.parse(regRaw) as unknown;
              if (Array.isArray(parsed)) {
                const cleaned = parsed.filter(
                  (x): x is RegisteredDevice =>
                    x &&
                    typeof x === 'object' &&
                    typeof (x as RegisteredDevice).deviceId === 'string' &&
                    ((x as RegisteredDevice).role === 'single' || (x as RegisteredDevice).role === 'gateway'),
                );
                setRegisteredDevices(cleaned.slice(0, 1));
              }
            } catch {
              setRegisteredDevices([]);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setHydratedRegistered(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRegistered) return;
    void AsyncStorage.setItem(KEYS.registered, JSON.stringify(registeredDevices));
  }, [registeredDevices, hydratedRegistered]);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !isFirebaseConfigured()) {
      setFirebaseRtdbConnected(false);
      return;
    }
    const r = ref(db, '.info/connected');
    let unsub: Unsubscribe | undefined;
    try {
      unsub = onValue(r, (snap) => setFirebaseRtdbConnected(snap.val() === true));
    } catch {
      setFirebaseRtdbConnected(false);
    }
    return () => {
      unsub?.();
    };
  }, [hydratedRegistered, registeredDevices.length]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !getFirebaseDb()) {
      setLiveSnapshots({});
      return;
    }
    const unsubs: (() => void)[] = [];
    for (const reg of registeredDevices) {
      unsubs.push(
        subscribeToDevice(reg.deviceId, (snap) => {
          setLiveSnapshots((prev) => ({ ...prev, [reg.deviceId]: snap }));
        }),
      );
    }
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [registeredDevices]);

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

  const addRegisteredDevice = useCallback(async (deviceId: string, options?: { bleProvisionName?: string }) => {
    const id = deviceId.trim();
    const fromOpts = options?.bleProvisionName?.trim();
    const bleProvisionName =
      fromOpts && fromOpts.startsWith('PROV_')
        ? fromOpts
        : id.startsWith('PROV_')
          ? id
          : `PROV_${id}`;

    setRegisteredDevices((prev) => {
      const existing = prev.find((r) => r.deviceId === id);
      const entry: RegisteredDevice = {
        deviceId: id,
        name: existing?.name ?? id,
        role: existing?.role ?? 'single',
        pondId: existing?.pondId ?? 'pond-a',
        provisionedAt: existing?.provisionedAt ?? new Date().toISOString(),
        bleProvisionName,
      };
      return [entry];
    });
  }, []);

  const removeRegisteredDevice = useCallback(async (deviceId: string) => {
    setRegisteredDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
    setLiveSnapshots((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  }, []);

  const getLiveSnapshot = useCallback(
    (deviceId: string): FirebaseDeviceSnapshot | undefined => liveSnapshots[deviceId],
    [liveSnapshots],
  );

  const getLiveDevice = useCallback(
    (deviceId: string): GatewayDevice | SingleDevice | null => {
      const snap = liveSnapshots[deviceId];
      if (!snap) return null;
      return mapFirebaseDeviceToAquaDevice(
        deviceId,
        snap.latest,
        snap.status,
        snap.receivedAt,
        firebaseRtdbConnected,
      );
    },
    [liveSnapshots, firebaseRtdbConnected],
  );

  const isRegisteredLiveDevice = useCallback(
    (deviceId: string) => registeredDevices.some((r) => r.deviceId === deviceId),
    [registeredDevices],
  );

  const ponds = useMemo(
    () =>
      pondsBase.map((p) => {
        if (p.id !== 'pond-a') return p;
        const extra = registeredDevices.filter((r) => r.pondId === 'pond-a').map((r) => r.deviceId);
        return { ...p, deviceIds: [...new Set([...p.deviceIds, ...extra])] };
      }),
    [pondsBase, registeredDevices],
  );

  const devices = useMemo(() => {
    const liveIds = new Set(registeredDevices.map((r) => r.deviceId));
    const base = seedDevices.filter((d) => !liveIds.has(d.id));
    const liveDevices: AquaDevice[] = registeredDevices.map((reg) => {
      const snap = liveSnapshots[reg.deviceId];
      if (!snap) return placeholderSingle(reg, firebaseRtdbConnected);
      return mapFirebaseDeviceToAquaDevice(
        reg.deviceId,
        snap.latest,
        snap.status,
        snap.receivedAt,
        firebaseRtdbConnected,
      );
    });
    return [...liveDevices, ...base];
  }, [registeredDevices, liveSnapshots, firebaseRtdbConnected]);

  const fullyHydrated = hydrated && hydratedRegistered;

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
      hydrated: fullyHydrated,
      registeredDevices,
      firebaseRtdbConnected,
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
      addRegisteredDevice,
      removeRegisteredDevice,
      getLiveDevice,
      getLiveSnapshot,
      isRegisteredLiveDevice,
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
      fullyHydrated,
      registeredDevices,
      firebaseRtdbConnected,
      setHasCompletedOnboarding,
      setMockLoggedIn,
      markAlertResolved,
      setThresholds,
      addPond,
      logout,
      addRegisteredDevice,
      removeRegisteredDevice,
      getLiveDevice,
      getLiveSnapshot,
      isRegisteredLiveDevice,
    ],
  );

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>;
}

export function useMockApp() {
  const ctx = useContext(MockAppContext);
  if (!ctx) throw new Error('useMockApp must be used within MockAppProvider');
  return ctx;
}
