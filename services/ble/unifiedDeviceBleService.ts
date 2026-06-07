import type { Device, Subscription } from 'react-native-ble-plx';
import type { BleDebugState, PairingBleDevice, PairingCommand, PairingNotification, PairingParent } from '../../types/pairing';
import type { BaseBleDebugPatch, BaseBleScanStats } from './baseBleService';
import { connectToDevice, disconnectDevice, monitorJson, scanDevices, stopScan, writeJson } from './baseBleService';
import { MOCK_BLE_CONFIG } from './bleConfigService';

export const UNIFIED_SERVICE_UUID = '8b6d0001-9d7a-4f5a-a909-5ccbd0e00100';
export const UNIFIED_RX_UUID = '8b6d0002-9d7a-4f5a-a909-5ccbd0e00100';
export const UNIFIED_TX_UUID = '8b6d0003-9d7a-4f5a-a909-5ccbd0e00100';
export const WQM_PAIR_NAME_PREFIX = 'WQMPAIR_';
export const WQM_DEVICE_NAME_PREFIX = 'WQM';
export const WQM_SCAN_NAME_PREFIXES = [WQM_PAIR_NAME_PREFIX, WQM_DEVICE_NAME_PREFIX] as const;

const MOCK_PARENTS: PairingParent[] = [
  { id: 'M1', role: 'GATEWAY', network_id: 'POND_001', root_gateway_id: 'M1', parent_id: '', depth: 0, child_count: 1, max_children: 5, rssi: -38, snr: 8.1, age_ms: 900 },
  { id: 'R1', role: 'RELAY', network_id: 'POND_001', root_gateway_id: 'M1', parent_id: 'M1', depth: 1, child_count: 1, max_children: 5, rssi: -57, snr: 6.4, age_ms: 1200 },
];

function parseDeviceIdFromName(name: string): string {
  if (name.startsWith(WQM_PAIR_NAME_PREFIX)) return name.slice(WQM_PAIR_NAME_PREFIX.length);
  if (name.startsWith('WQM_')) return name.slice('WQM_'.length);
  if (name.startsWith(WQM_DEVICE_NAME_PREFIX)) return name.slice(WQM_DEVICE_NAME_PREFIX.length);
  return name;
}

export class UnifiedDeviceBleService {
  private currentDevice: Device | null = null;
  private notificationSub: Subscription | null = null;
  private mockCallback: ((notification: PairingNotification) => void) | null = null;
  private debugCallback: ((patch: Partial<BleDebugState>) => void) | null = null;

  setDebugListener(callback: ((patch: Partial<BleDebugState>) => void) | null): void {
    this.debugCallback = callback;
  }

  private emitDebug(patch: Partial<BleDebugState> | BaseBleDebugPatch): void {
    this.debugCallback?.(patch);
  }

  async scanWqmPairDevices(
    onDevice: (device: PairingBleDevice) => void,
    onError: (message: string) => void,
    onStats?: (stats: BaseBleScanStats) => void,
  ): Promise<void> {
    await scanDevices({
      namePrefix: [...WQM_SCAN_NAME_PREFIXES],
      mockDevices: [
        { id: 'mock-pair-m1', name: 'WQMPAIR_M1', rssi: -44 },
        { id: 'mock-pair-c1', name: 'WQMC1', rssi: -56 },
      ],
      onDevice: (device) => onDevice({ ...device, deviceId: parseDeviceIdFromName(device.name) }),
      onError,
      onStats,
    });
  }

  stopScan(): void {
    stopScan();
  }

  async connect(deviceId: string): Promise<{ id: string; name: string }> {
    if (MOCK_BLE_CONFIG) {
      return { id: deviceId, name: WQM_SCAN_NAME_PREFIXES.some((prefix) => deviceId.startsWith(prefix)) ? deviceId : `WQM${deviceId}` };
    }
    this.currentDevice = await connectToDevice(deviceId);
    const connected = { id: this.currentDevice.id, name: this.currentDevice.name ?? this.currentDevice.localName ?? deviceId };
    this.emitDebug({ connectedDeviceId: connected.id, connectedDeviceName: connected.name });
    await this.inspectCharacteristics();
    return connected;
  }

  async disconnect(): Promise<void> {
    this.notificationSub?.remove();
    this.notificationSub = null;
    this.mockCallback = null;
    const device = this.currentDevice;
    this.currentDevice = null;
    this.stopScan();
    await disconnectDevice(device);
  }

  subscribeNotifications(callback: (notification: PairingNotification) => void, onError?: (message: string) => void): () => void {
    if (MOCK_BLE_CONFIG) {
      this.mockCallback = callback;
      return () => {
        this.mockCallback = null;
      };
    }
    if (!this.currentDevice) throw new Error('No WQMPAIR device is connected.');
    this.notificationSub?.remove();
    this.notificationSub = monitorJson<PairingNotification>(
      this.currentDevice,
      UNIFIED_SERVICE_UUID,
      UNIFIED_TX_UUID,
      callback,
      onError,
      (patch) => this.emitDebug(patch),
    );
    return () => {
      this.notificationSub?.remove();
      this.notificationSub = null;
    };
  }

  async writeCommand(command: PairingCommand): Promise<void> {
    const commandJson = JSON.stringify(command);
    this.emitDebug({ lastCommand: commandJson });
    if (MOCK_BLE_CONFIG) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      this.emitMock(command);
      return;
    }
    if (!this.currentDevice) throw new Error('No WQMPAIR device is connected.');
    await writeJson(this.currentDevice, UNIFIED_SERVICE_UUID, UNIFIED_RX_UUID, command);
  }

  private async inspectCharacteristics(): Promise<void> {
    if (MOCK_BLE_CONFIG) {
      this.emitDebug({ serviceFound: true, rxFound: true, txFound: true });
      return;
    }
    if (!this.currentDevice) return;
    try {
      const services = await this.currentDevice.services();
      const service = services.find((item) => item.uuid.toLowerCase() === UNIFIED_SERVICE_UUID);
      let rxFound = false;
      let txFound = false;
      if (service) {
        const characteristics = await this.currentDevice.characteristicsForService(UNIFIED_SERVICE_UUID);
        rxFound = characteristics.some((item) => item.uuid.toLowerCase() === UNIFIED_RX_UUID);
        txFound = characteristics.some((item) => item.uuid.toLowerCase() === UNIFIED_TX_UUID);
      }
      this.emitDebug({ serviceFound: !!service, rxFound, txFound });
    } catch (error) {
      this.emitDebug({ lastError: error instanceof Error ? error.message : String(error) });
    }
  }

  getInfo(): Promise<void> {
    return this.writeCommand({ cmd: 'info' });
  }

  setId(deviceId: string, networkId: string): Promise<void> {
    return this.writeCommand({ cmd: 'set_id', device_id: deviceId, network_id: networkId });
  }

  setWifi(ssid: string, password: string, gateway = true): Promise<void> {
    return this.writeCommand({ cmd: 'set_wifi', ssid, password, gateway });
  }

  scanWifi(useAlias = false): Promise<void> {
    return this.writeCommand({ cmd: useAlias ? 'wifi_scan' : 'scan_wifi' });
  }

  scanParents(): Promise<void> {
    return this.writeCommand({ cmd: 'scan' });
  }

  pairNode(parentId: string, role: 'CHILD' | 'RELAY', networkId: string): Promise<void> {
    return this.writeCommand({ cmd: 'pair', parent_id: parentId, role, network_id: networkId });
  }

  resetPair(): Promise<void> {
    return this.writeCommand({ cmd: 'reset_pair' });
  }

  factoryReset(): Promise<void> {
    return this.writeCommand({ cmd: 'factory' });
  }

  private emitMock(command: PairingCommand): void {
    if (!this.mockCallback) return;
    if (command.cmd === 'info') {
      this.mockCallback({
        type: 'info',
        device_id: 'M1',
        network_id: 'POND_001',
        role: 'UNPAIRED',
        switch_mode: 'PAIRING',
        parent_id: '',
        root_gateway_id: '',
        lora_ready: true,
        wifi_connected: false,
        paired: false,
      });
    }
    if (command.cmd === 'set_id') this.mockCallback({ type: 'set_id', ok: true });
    if (command.cmd === 'scan_wifi' || command.cmd === 'wifi_scan') {
      this.mockCallback({
        type: 'wifi_scan',
        ok: true,
        items: [
          { ssid: 'BUBT Hub', rssi: -45, secure: true },
          { ssid: 'Home WiFi', rssi: -66, secure: true },
          { ssid: 'Open Network', rssi: -72, secure: false },
        ],
      });
    }
    if (command.cmd === 'set_wifi') {
      this.mockCallback({ type: 'wifi_result', ok: true, stage: 'connecting' });
      setTimeout(() => this.mockCallback?.({ type: 'wifi_result', ok: true, stage: 'connected', ip: '192.168.0.100' }), 900);
    }
    if (command.cmd === 'scan') this.mockCallback({ type: 'parents', items: MOCK_PARENTS });
    if (command.cmd === 'pair') {
      this.mockCallback({ type: 'pair_started', ok: true, parent_id: command.parent_id, role: command.role });
      setTimeout(() => this.mockCallback?.({ type: 'pair_result', ok: true, stage: 'saved', parent_id: command.parent_id, root_gateway_id: command.parent_id.startsWith('M') ? command.parent_id : 'M1' }), 600);
      setTimeout(() => this.mockCallback?.({ type: 'server_test', status: 'sent', test_id: `${command.role}_MOCK_${Date.now()}` }), 1100);
    }
    if (command.cmd === 'reset_pair') this.mockCallback({ type: 'reset_pair', ok: true });
    if (command.cmd === 'factory') this.mockCallback({ type: 'factory', ok: true, message: 'Restarting' });
  }
}

export const unifiedDeviceBleService = new UnifiedDeviceBleService();
