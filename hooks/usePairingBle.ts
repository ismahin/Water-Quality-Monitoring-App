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

function normalizeDecodedInfo(decoded: string | undefined, fallbackName?: string): PairingBleInfo | null {
  if (!decoded) return null;
  try {
    const value = JSON.parse(decoded) as PairingNotification;
    return normalizeInfoNotification(value, fallbackName);
  } catch {
    return null;
  }
}

function isParentsNotification(notification: PairingNotification): notification is PairingNotification & { items: PairingParent[] } {
  return notification.type === 'parents' && Array.isArray(notification.items);
}

function isDisconnectedMessage(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const low = message.toLowerCase();
  return low.includes('not connected') || low.includes('disconnected') || low.includes('device disconnected');
}

export function usePairingBle() {
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedDeviceNameRef = useRef<string | undefined>(undefined);
  const lastNotificationKeyRef = useRef('');
  const lastParentsKeyRef = useRef('');
  const lastDebugPatchRef = useRef('');
  const lastDebugPatchAtRef = useRef(0);
  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devicesRef = useRef<Map<string, PairingBleDevice>>(new Map());
  const devicesFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const now = Date.now();
      const patchKey = JSON.stringify(patch);
      if (patchKey === lastDebugPatchRef.current && now - lastDebugPatchAtRef.current < 1000) return;
      lastDebugPatchRef.current = patchKey;
      lastDebugPatchAtRef.current = now;
      setDebug((prev) => ({ ...prev, ...patch }));
      const infoNotification = normalizeDecodedInfo(patch.lastDecodedResponse, connectedDeviceNameRef.current);
      if (infoNotification) {
        console.log('[BLE INFO] Normalized device info from decoded fallback:', JSON.stringify(infoNotification));
        setInfo(infoNotification);
        setDebug((prev) => ({
          ...prev,
          lastInfoJson: patch.lastDecodedResponse,
          rawInfoLoraReady: String(infoNotification.lora_ready),
          normalizedInfoLoraReady: String(infoNotification.loraReady),
        }));
      }
    });
    return () => {
      unifiedDeviceBleService.setDebugListener(null);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (devicesFlushTimerRef.current) clearTimeout(devicesFlushTimerRef.current);
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
      unifiedDeviceBleService.stopScan();
      void unifiedDeviceBleService.disconnect();
    };
  }, []);

  const handleNotification = useCallback((notification: PairingNotification) => {
    if (commandTimeoutRef.current) {
      clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }
    const notificationKey = JSON.stringify(notification);
    if (notificationKey !== lastNotificationKeyRef.current) {
      lastNotificationKeyRef.current = notificationKey;
      setNotifications((prev) => [notification, ...prev].slice(0, 30));
    }
    const infoNotification = normalizeInfoNotification(notification, connectedDeviceNameRef.current);
    if (infoNotification) {
      console.log('[BLE INFO] Normalized device info:', JSON.stringify(infoNotification));
      setInfo(infoNotification);
      setDebug((prev) => ({
        ...prev,
        lastInfoJson: JSON.stringify(notification),
        rawInfoLoraReady: String((notification as Record<string, unknown>).lora_ready ?? (notification as Record<string, unknown>).loraReady ?? '-'),
        normalizedInfoLoraReady: String(infoNotification.loraReady),
      }));
    }
    if (isParentsNotification(notification)) {
      const parentsKey = JSON.stringify(notification.items.map((parent) => ({
        id: parent.id,
        role: parent.role,
        network_id: parent.network_id,
        root_gateway_id: parent.root_gateway_id,
        rssi: parent.rssi,
        snr: parent.snr,
      })));
      if (parentsKey === lastParentsKeyRef.current) return;
      lastParentsKeyRef.current = parentsKey;
      setDebug((prev) => ({ ...prev, lastParentsJson: notificationKey }));
      setParents((prev) => {
        const map = new Map(prev.map((parent) => [parent.id, parent]));
        notification.items.forEach((parent) => {
          const old = map.get(parent.id);
          if (!old || (parent.rssi ?? -120) > (old.rssi ?? -120)) map.set(parent.id, parent);
        });
        return Array.from(map.values()).sort((a, b) => (b.rssi ?? -120) - (a.rssi ?? -120));
      });
    }
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    setDevices([]);
    devicesRef.current = new Map();
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
        const old = devicesRef.current.get(device.id);
        if (!old || Math.abs(device.rssi - old.rssi) >= 4 || old.name !== device.name) {
          devicesRef.current.set(device.id, !old || device.rssi > old.rssi ? device : { ...device, rssi: old.rssi });
        }
        if (!devicesFlushTimerRef.current) {
          devicesFlushTimerRef.current = setTimeout(() => {
            devicesFlushTimerRef.current = null;
            setDevices(Array.from(devicesRef.current.values()).sort((a, b) => b.rssi - a.rssi));
          }, 250);
        }
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
      if (devicesFlushTimerRef.current) {
        clearTimeout(devicesFlushTimerRef.current);
        devicesFlushTimerRef.current = null;
      }
      setDevices(Array.from(devicesRef.current.values()).sort((a, b) => b.rssi - a.rssi));
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
        connectedDeviceNameRef.current = connected.name;
        setConnectedDevice(connected);
        unifiedDeviceBleService.subscribeNotifications(handleNotification, (message) => {
          setError(message);
          if (message.toLowerCase().includes('disconnect') || message.toLowerCase().includes('not connected')) {
            connectedDeviceNameRef.current = undefined;
            setConnectedDevice(null);
          }
        });
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
    connectedDeviceNameRef.current = undefined;
    setConnectedDevice(null);
    setInfo(null);
    setParents([]);
    setDebug({});
  }, []);

  const clearParents = useCallback(() => {
    setParents([]);
  }, []);

  const runCommandWithTimeout = useCallback(async (send: () => Promise<void>, timeoutMs = 10000) => {
    if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
    setError(null);
    commandTimeoutRef.current = setTimeout(() => {
      commandTimeoutRef.current = null;
      setError('BLE command timed out. The device did not send a response.');
    }, timeoutMs);
    try {
      await send();
    } catch (error) {
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
      }
      if (isDisconnectedMessage(error)) {
        connectedDeviceNameRef.current = undefined;
        setConnectedDevice(null);
        setError('Bluetooth disconnected. Please reconnect the device and try again.');
      }
      throw error;
    }
  }, []);

  const actions = useMemo(
    () => ({
      getInfo: () => runCommandWithTimeout(() => unifiedDeviceBleService.getInfo()),
      setIdentity: (deviceId: string, networkId: string) => runCommandWithTimeout(() => unifiedDeviceBleService.setId(deviceId, networkId)),
      setWifi: (ssid: string, password: string, gateway = true) => runCommandWithTimeout(() => unifiedDeviceBleService.setWifi(ssid, password, gateway), 15000),
      scanWifi: (useAlias = false, maxResults?: number) => runCommandWithTimeout(() => unifiedDeviceBleService.scanWifi(useAlias, maxResults), 15000),
      wifiStatus: () => runCommandWithTimeout(() => unifiedDeviceBleService.wifiStatus()),
      scanParents: () => runCommandWithTimeout(() => unifiedDeviceBleService.scanParents(), 12000),
      startPairing: (parentId: string, role: 'CHILD' | 'RELAY', networkId: string) =>
        runCommandWithTimeout(() => unifiedDeviceBleService.pairNode(parentId, role, networkId), 15000),
      resetPairing: () => runCommandWithTimeout(() => unifiedDeviceBleService.resetPair()),
      factoryReset: () => runCommandWithTimeout(() => unifiedDeviceBleService.factoryReset()),
      clearWifi: () => runCommandWithTimeout(() => unifiedDeviceBleService.clearWifi()),
    }),
    [runCommandWithTimeout],
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
    clearParents,
    actions,
  };
}
