import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeDeviceInfo } from '../types/pairing';
import type { BleDebugState, PairingBleDevice, PairingBleInfo, PairingNotification, PairingParent } from '../types/pairing';
import type { BaseBleScanStats } from '../services/ble/baseBleService';
import { unifiedDeviceBleService } from '../services/ble/unifiedDeviceBleService';

function fallbackDeviceIdFromName(name?: string): string {
  if (!name) return '';
  if (name.startsWith('WQMPAIR_')) return name.slice('WQMPAIR_'.length);
  return name;
}

function normalizeInfoNotification(notification: PairingNotification, fallbackName?: string): PairingBleInfo | null {
  const raw = notification as Record<string, unknown>;
  const marker = raw.type ?? raw.cmd ?? raw.t;
  if (marker !== 'info' && marker !== 'hello') return null;
  return normalizeDeviceInfo(raw, fallbackDeviceIdFromName(fallbackName));
}

function isParentsNotification(notification: PairingNotification): notification is PairingNotification & { items: PairingParent[] } {
  return notification.type === 'parents' && Array.isArray(notification.items);
}

export function usePairingBle() {
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [devices, setDevices] = useState<PairingBleDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<{ id: string; name: string } | null>(null);
  const [info, setInfo] = useState<PairingBleInfo | null>(null);
  const [parents, setParents] = useState<PairingParent[]>([]);
  const [notifications, setNotifications] = useState<PairingNotification[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<BleDebugState>({});
  const [scanStats, setScanStats] = useState<BaseBleScanStats>({
    totalAdvertisements: 0,
    namedAdvertisements: 0,
    matchedAdvertisements: 0,
    nearbyDevices: [],
  });

  useEffect(() => {
    unifiedDeviceBleService.setDebugListener((patch) => {
      setDebug((prev) => ({ ...prev, ...patch }));
    });
    return () => {
      unifiedDeviceBleService.setDebugListener(null);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      unifiedDeviceBleService.stopScan();
      void unifiedDeviceBleService.disconnect();
    };
  }, []);

  const handleNotification = useCallback((notification: PairingNotification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 20));
    const infoNotification = normalizeInfoNotification(notification, connectedDevice?.name);
    if (infoNotification) {
      setInfo(infoNotification);
      setDebug((prev) => ({
        ...prev,
        lastInfoJson: JSON.stringify(notification),
        rawInfoLoraReady: String((notification as Record<string, unknown>).lora_ready ?? (notification as Record<string, unknown>).loraReady ?? '-'),
        normalizedInfoLoraReady: String(infoNotification.loraReady),
      }));
    }
    if (isParentsNotification(notification)) {
      setDebug((prev) => ({ ...prev, lastParentsJson: JSON.stringify(notification) }));
      setParents((prev) => {
        const map = new Map(prev.map((parent) => [parent.id, parent]));
        notification.items.forEach((parent) => {
          const old = map.get(parent.id);
          if (!old || (parent.rssi ?? -120) > (old.rssi ?? -120)) map.set(parent.id, parent);
        });
        return Array.from(map.values()).sort((a, b) => (b.rssi ?? -120) - (a.rssi ?? -120));
      });
    }
  }, [connectedDevice?.name]);

  const startScan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setScanStats({
      totalAdvertisements: 0,
      namedAdvertisements: 0,
      matchedAdvertisements: 0,
      nearbyDevices: [],
    });
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setScanning(true);
    await unifiedDeviceBleService.scanWqmPairDevices(
      (device) => {
        setDevices((prev) => {
          const map = new Map(prev.map((item) => [item.id, item]));
          const old = map.get(device.id);
          if (!old || device.rssi > old.rssi) map.set(device.id, device);
          return Array.from(map.values()).sort((a, b) => b.rssi - a.rssi);
        });
      },
      (message) => {
        setError(message);
        setScanning(false);
      },
      setScanStats,
    );
    scanTimerRef.current = setTimeout(() => {
      unifiedDeviceBleService.stopScan();
      setScanning(false);
      scanTimerRef.current = null;
    }, 7000);
  }, []);

  const stopScan = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    unifiedDeviceBleService.stopScan();
    setScanning(false);
  }, []);

  const connect = useCallback(
    async (id: string) => {
      setConnecting(true);
      setError(null);
      try {
        stopScan();
        const connected = await unifiedDeviceBleService.connect(id);
        setConnectedDevice(connected);
        unifiedDeviceBleService.subscribeNotifications(handleNotification, setError);
        await new Promise((resolve) => setTimeout(resolve, 500));
        await unifiedDeviceBleService.getInfo();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not connect to pairing device.');
      } finally {
        setConnecting(false);
      }
    },
    [handleNotification, stopScan],
  );

  const disconnect = useCallback(async () => {
    await unifiedDeviceBleService.disconnect();
    setConnectedDevice(null);
    setInfo(null);
    setDebug({});
  }, []);

  const actions = useMemo(
    () => ({
      getInfo: () => unifiedDeviceBleService.getInfo(),
      setIdentity: (deviceId: string, networkId: string) => unifiedDeviceBleService.setId(deviceId, networkId),
      setWifi: (ssid: string, password: string, gateway = true) => unifiedDeviceBleService.setWifi(ssid, password, gateway),
      scanWifi: (useAlias = false, maxResults?: number) => unifiedDeviceBleService.scanWifi(useAlias, maxResults),
      scanParents: () => unifiedDeviceBleService.scanParents(),
      startPairing: (parentId: string, role: 'CHILD' | 'RELAY', networkId: string) =>
        unifiedDeviceBleService.pairNode(parentId, role, networkId),
      resetPairing: () => unifiedDeviceBleService.resetPair(),
      factoryReset: () => unifiedDeviceBleService.factoryReset(),
    }),
    [],
  );

  const scanSummary = useMemo(() => {
    if (scanStats.matchedAdvertisements > 0) {
      return `Found ${devices.length} AquaNode BLE device${devices.length === 1 ? '' : 's'}.`;
    }
    if (scanStats.nearbyDevices.length > 0) {
      const nearby = scanStats.nearbyDevices
        .slice(0, 3)
        .map((device) => `${device.name} (${device.rssi} dBm)`)
        .join(', ');
      return `Phone sees nearby BLE devices, but none named WQMPAIR_. Nearby: ${nearby}`;
    }
    if (scanStats.totalAdvertisements > 0) {
      return `Phone received ${scanStats.totalAdvertisements} BLE advertisements, but none had a visible name.`;
    }
    return scanning ? 'Scanning for WQMPAIR advertisements...' : 'No BLE advertisements were reported during the last scan.';
  }, [devices.length, scanStats, scanning]);

  return {
    devices,
    connectedDevice,
    info,
    parents,
    notifications,
    scanning,
    scanStats,
    scanSummary,
    debug,
    connecting,
    error,
    setError,
    startScan,
    stopScan,
    connect,
    disconnect,
    actions,
  };
}
