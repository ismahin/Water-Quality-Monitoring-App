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
import type { AquaDevice, ChildDevice, GatewayDevice, RelayDevice, SingleDevice } from '../types/device';
import type { Pond } from '../types/pond';
import type { SensorThresholds } from '../types/sensor';
import type { FirebaseChildSnapshot, FirebaseDeviceSnapshot, FirebaseNetworkNode } from '../types/firebase';
import type { RegisteredDevice, UniversalRole } from '../types/universalDevice';
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
  mapFirebaseChildToAppDevice,
  mapFirebaseOwnDeviceToAppDevice,
  subscribeToDeviceChildren,
  subscribeToDeviceNetwork,
  subscribeToOwnDevice,
} from '../services/firebase/deviceTelemetryService';

const KEYS = {
  onboarded: '@aquanode/hasCompletedOnboarding',
  session: '@aquanode/mockLoggedIn',
  registered: '@aquanode/registeredDevices',
};

export type TempUnit = 'C' | 'F';
export type TdsUnit = 'ppm' | 'ec';
export type AppThemePref = 'light' | 'system';

type AddRegisteredOptions = {
  name?: string;
  networkId?: string;
  roleHint?: UniversalRole | string;
  rootGatewayId?: string;
  parentId?: string;
  bleProvisionName?: string;
  bleConfigName?: string;
  pondId?: string;
};

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
  addRegisteredDevice: (deviceId: string, options?: AddRegisteredOptions) => Promise<void>;
  removeRegisteredDevice: (deviceId: string) => Promise<void>;
  updateRegisteredDeviceName: (deviceId: string, name: string) => Promise<void>;
  getLiveDevice: (deviceId: string) => AquaDevice | null;
  getLiveSnapshot: (deviceId: string) => FirebaseDeviceSnapshot | undefined;
  getGatewayChildren: (gatewayId: string) => AquaDevice[];
  getNetworkTree: (gatewayId: string) => AquaDevice[];
  getGatewayNetwork: (gatewayId: string) => Record<string, FirebaseNetworkNode>;
  isRegisteredLiveDevice: (deviceId: string) => boolean;
}

const MockAppContext = createContext<MockAppContextValue | null>(null);

function normalizeRegistered(raw: unknown): RegisteredDevice[] {
  if (!Array.isArray(raw)) return [];
  const out: RegisteredDevice[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const deviceId = typeof o.deviceId === 'string' ? o.deviceId.trim() : '';
    if (!deviceId) continue;
    const legacyRole = typeof o.role === 'string' ? o.role : undefined;
    const roleHint =
      typeof o.roleHint === 'string'
        ? o.roleHint
        : legacyRole === 'gateway'
          ? 'GATEWAY'
          : legacyRole === 'single'
            ? 'SINGLE'
            : undefined;
    out.push({
      deviceId,
      name: typeof o.name === 'string' && o.name.trim() ? o.name : deviceId,
      networkId: typeof o.networkId === 'string' ? o.networkId : '',
      roleHint,
      rootGatewayId: typeof o.rootGatewayId === 'string' ? o.rootGatewayId : undefined,
      parentId: typeof o.parentId === 'string' ? o.parentId : undefined,
      registeredAt:
        typeof o.registeredAt === 'string'
          ? o.registeredAt
          : typeof o.provisionedAt === 'string'
            ? o.provisionedAt
            : new Date().toISOString(),
      provisionedAt: typeof o.provisionedAt === 'string' ? o.provisionedAt : undefined,
      pondId: typeof o.pondId === 'string' ? o.pondId : 'pond-a',
      bleProvisionName: typeof o.bleProvisionName === 'string' ? o.bleProvisionName : undefined,
      bleConfigName: typeof o.bleConfigName === 'string' ? o.bleConfigName : undefined,
    });
  }
  return out;
}

function placeholderDevice(reg: RegisteredDevice, firebaseRtdbConnected: boolean): AquaDevice {
  const roleHint = String(reg.roleHint ?? 'SINGLE').toUpperCase();
  const now = reg.registeredAt || reg.provisionedAt || new Date().toISOString();
  const base = {
    id: reg.deviceId,
    name: reg.name,
    pondId: reg.pondId ?? 'pond-a',
    online: 'offline' as const,
    batteryPercent: 0,
    lastSeenAt: now,
    lastDataAt: now,
    sensors: { ph: 0, tdsPpm: 0, temperatureC: 0, turbidityNtu: 0 },
    calibrationStatus: 'ok' as const,
    firmwareVersion: '1.0.0',
    universalRole: roleHint as UniversalRole,
    hardwareMode: roleHint === 'SINGLE' ? 'SINGLE' : 'NETWORK',
    networkId: reg.networkId,
    parentId: reg.parentId,
    rootGatewayId: reg.rootGatewayId,
    isLive: true,
    isDemo: false,
  };
  if (roleHint === 'GATEWAY') {
    return {
      ...base,
      role: 'gateway',
      wifiSsid: '-',
      wifiRssi: -100,
      cloudOnline: firebaseRtdbConnected,
      loraGatewayEnabled: false,
      gatewayUplinkEnabled: true,
      childDeviceIds: [],
    } satisfies GatewayDevice;
  }
  if (roleHint === 'RELAY') {
    return {
      ...base,
      role: 'relay',
      parentId: reg.parentId ?? '',
      relayEnabled: true,
      loraRssi: -120,
      loraSnr: 0,
      packetSuccessPercent: 0,
      childDeviceIds: [],
    } satisfies RelayDevice;
  }
  if (roleHint === 'CHILD') {
    return {
      ...base,
      role: 'child',
      parentId: reg.parentId ?? '',
      relayEnabled: false,
      loraRssi: -120,
      loraSnr: 0,
      packetSuccessPercent: 0,
    } satisfies ChildDevice;
  }
  return {
    ...base,
    role: 'single',
    wifiSsid: '-',
    wifiRssi: -100,
    cloudOnline: firebaseRtdbConnected,
  } satisfies SingleDevice;
}

function deviceSort(a: AquaDevice, b: AquaDevice): number {
  const order = { gateway: 0, relay: 1, child: 2, single: 3 } as const;
  return order[a.role] - order[b.role] || a.id.localeCompare(b.id);
}

function inferGatewayIds(registered: RegisteredDevice[], liveDevices: AquaDevice[]): string[] {
  const ids = new Set<string>();
  for (const reg of registered) {
    const role = String(reg.roleHint ?? '').toUpperCase();
    if (role === 'GATEWAY' || reg.rootGatewayId === reg.deviceId) ids.add(reg.deviceId);
    if (reg.rootGatewayId) ids.add(reg.rootGatewayId);
  }
  for (const device of liveDevices) {
    if (device.role === 'gateway' || device.universalRole === 'GATEWAY') ids.add(device.id);
    if (device.rootGatewayId) ids.add(device.rootGatewayId);
  }
  return Array.from(ids).filter(Boolean);
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
  const [childSnapshotsByGateway, setChildSnapshotsByGateway] = useState<Record<string, Record<string, FirebaseChildSnapshot>>>({});
  const [networkByGateway, setNetworkByGateway] = useState<Record<string, Record<string, FirebaseNetworkNode>>>({});
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
              setRegisteredDevices(normalizeRegistered(JSON.parse(regRaw)));
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
    let unsub: Unsubscribe | undefined;
    try {
      unsub = onValue(ref(db, '.info/connected'), (snap) => setFirebaseRtdbConnected(snap.val() === true));
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
    const unsubs = registeredDevices.map((reg) =>
      subscribeToOwnDevice(reg.deviceId, (snap) => {
        setLiveSnapshots((prev) => ({ ...prev, [reg.deviceId]: snap }));
      }),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [registeredDevices]);

  const ownLiveDevices = useMemo(() => {
    return registeredDevices.map((reg) => {
      const snap = liveSnapshots[reg.deviceId];
      if (!snap) return placeholderDevice(reg, firebaseRtdbConnected);
      return mapFirebaseOwnDeviceToAppDevice(
        reg.deviceId,
        snap.latest,
        snap.status,
        snap.receivedAt,
        firebaseRtdbConnected,
        reg.name,
      );
    });
  }, [registeredDevices, liveSnapshots, firebaseRtdbConnected]);

  const gatewayIds = useMemo(() => inferGatewayIds(registeredDevices, ownLiveDevices), [registeredDevices, ownLiveDevices]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !getFirebaseDb()) {
      setChildSnapshotsByGateway({});
      setNetworkByGateway({});
      return;
    }
    const unsubs: Array<() => void> = [];
    for (const gatewayId of gatewayIds) {
      unsubs.push(
        subscribeToDeviceChildren(gatewayId, (childrenForGateway) => {
          setChildSnapshotsByGateway((prev) => ({ ...prev, [gatewayId]: childrenForGateway }));
        }),
      );
      unsubs.push(
        subscribeToDeviceNetwork(gatewayId, (networkForGateway) => {
          setNetworkByGateway((prev) => ({ ...prev, [gatewayId]: networkForGateway }));
        }),
      );
    }
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [gatewayIds]);

  const liveChildDevices = useMemo(() => {
    const out: AquaDevice[] = [];
    for (const gatewayId of gatewayIds) {
      const children = childSnapshotsByGateway[gatewayId] ?? {};
      const network = networkByGateway[gatewayId] ?? {};
      const childIds = new Set([...Object.keys(children), ...Object.keys(network)]);
      for (const sourceId of childIds) {
        const child = children[sourceId];
        const net = network[sourceId];
        const reg = registeredDevices.find((r) => r.deviceId === sourceId);
        out.push(
          mapFirebaseChildToAppDevice(
            gatewayId,
            sourceId,
            child?.latest ?? null,
            child?.status ?? null,
            net ?? child?.network ?? null,
            child?.receivedAt ?? new Date().toISOString(),
            reg?.name,
          ),
        );
      }
    }
    return out.sort(deviceSort);
  }, [gatewayIds, childSnapshotsByGateway, networkByGateway, registeredDevices]);

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

  const addRegisteredDevice = useCallback(async (deviceId: string, options?: AddRegisteredOptions) => {
    const id = deviceId.trim();
    if (!id) return;
    setRegisteredDevices((prev) => {
      const existing = prev.find((r) => r.deviceId === id);
      const entry: RegisteredDevice = {
        deviceId: id,
        name: options?.name?.trim() || existing?.name || id,
        networkId: options?.networkId ?? existing?.networkId ?? '',
        roleHint: options?.roleHint ?? existing?.roleHint,
        rootGatewayId: options?.rootGatewayId ?? existing?.rootGatewayId,
        parentId: options?.parentId ?? existing?.parentId,
        registeredAt: existing?.registeredAt ?? new Date().toISOString(),
        provisionedAt: existing?.provisionedAt ?? new Date().toISOString(),
        pondId: options?.pondId ?? existing?.pondId ?? 'pond-a',
        bleProvisionName: options?.bleProvisionName ?? existing?.bleProvisionName,
        bleConfigName: options?.bleConfigName ?? existing?.bleConfigName,
      };
      return [entry, ...prev.filter((r) => r.deviceId !== id)];
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

  const updateRegisteredDeviceName = useCallback(async (deviceId: string, name: string) => {
    setRegisteredDevices((prev) =>
      prev.map((d) => (d.deviceId === deviceId ? { ...d, name: name.trim() || d.deviceId } : d)),
    );
  }, []);

  const getLiveSnapshot = useCallback(
    (deviceId: string): FirebaseDeviceSnapshot | undefined => liveSnapshots[deviceId],
    [liveSnapshots],
  );

  const allLiveDevices = useMemo(() => [...ownLiveDevices, ...liveChildDevices].sort(deviceSort), [ownLiveDevices, liveChildDevices]);

  const getLiveDevice = useCallback(
    (deviceId: string): AquaDevice | null => allLiveDevices.find((d) => d.id === deviceId || d.sourceId === deviceId) ?? null,
    [allLiveDevices],
  );

  const getGatewayChildren = useCallback(
    (gatewayId: string): AquaDevice[] =>
      allLiveDevices
        .filter((d) => d.gatewayId === gatewayId || d.rootGatewayId === gatewayId)
        .filter((d) => d.id !== gatewayId)
        .sort(deviceSort),
    [allLiveDevices],
  );

  const getGatewayNetwork = useCallback(
    (gatewayId: string): Record<string, FirebaseNetworkNode> => networkByGateway[gatewayId] ?? {},
    [networkByGateway],
  );

  const getNetworkTree = useCallback(
    (gatewayId: string): AquaDevice[] => {
      const root = allLiveDevices.find((d) => d.id === gatewayId) ?? seedDevices.find((d) => d.id === gatewayId);
      const childrenForGateway = getGatewayChildren(gatewayId);
      return root ? [root, ...childrenForGateway] : childrenForGateway;
    },
    [allLiveDevices, getGatewayChildren],
  );

  const isRegisteredLiveDevice = useCallback(
    (deviceId: string) => registeredDevices.some((r) => r.deviceId === deviceId),
    [registeredDevices],
  );

  const ponds = useMemo(
    () =>
      pondsBase.map((p) => {
        if (p.id !== 'pond-a') return p;
        const liveIds = allLiveDevices.map((d) => d.id);
        return { ...p, deviceIds: [...new Set([...p.deviceIds, ...liveIds])] };
      }),
    [pondsBase, allLiveDevices],
  );

  const devices = useMemo(() => {
    const liveIds = new Set(allLiveDevices.map((d) => d.id));
    const base = seedDevices.filter((d) => !liveIds.has(d.id)).map((d) => ({ ...d, isDemo: true, isLive: false }));
    return [...allLiveDevices, ...base];
  }, [allLiveDevices]);

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
      updateRegisteredDeviceName,
      getLiveDevice,
      getLiveSnapshot,
      getGatewayChildren,
      getNetworkTree,
      getGatewayNetwork,
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
      updateRegisteredDeviceName,
      getLiveDevice,
      getLiveSnapshot,
      getGatewayChildren,
      getNetworkTree,
      getGatewayNetwork,
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
