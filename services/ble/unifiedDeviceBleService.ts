import type { Device, Subscription } from 'react-native-ble-plx';
import type { BleDebugState, PairingBleDevice, PairingCommand, PairingNotification, PairingParent } from '../../types/pairing';
import type { BaseBleDebugPatch, BaseBleScanStats } from './baseBleService';
import { connectToDevice, disconnectDevice, monitorJson, scanDevices, stopScan, writeJson } from './baseBleService';
import { MOCK_BLE_CONFIG } from './bleConfigService';

export const UNIFIED_SERVICE_UUID = '8b6d0001-9d7a-4f5a-a909-5ccbd0e00100';
export const UNIFIED_RX_UUID = '8b6d0002-9d7a-4f5a-a909-5ccbd0e00100';
export const UNIFIED_TX_UUID = '8b6d0003-9d7a-4f5a-a909-5ccbd0e00100';
export const WQM_PAIR_NAME_PREFIX = 'WQMPAIR_';

const MOCK_PARENTS: PairingParent[] = [
  { id: 'M1', role: 'GATEWAY', network_id: 'POND_001', root_gateway_id: 'M1', parent_id: '', depth: 0, child_count: 1, max_children: 5, rssi: -38, snr: 8.1, age_ms: 900 },
  { id: 'R1', role: 'RELAY', network_id: 'POND_001', root_gateway_id: 'M1', parent_id: 'M1', depth: 1, child_count: 1, max_children: 5, rssi: -57, snr: 6.4, age_ms: 1200 },
  { id: 'C1', role: 'RELAY_CANDIDATE', network_id: 'POND_001', root_gateway_id: 'M1', parent_id: 'M1', depth: 1, child_count: 0, max_children: 5, rssi: -49, snr: 7.2, age_ms: 1000 },
];

function makeBleCommand(cmd: string, args: Record<string, unknown> = {}): PairingCommand {
  return {
    v: 2,
    cmd_id: `app_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    cmd,
    args,
  };
}

function parseDeviceIdFromName(name: string): string {
  if (name.startsWith(WQM_PAIR_NAME_PREFIX)) return name.slice(WQM_PAIR_NAME_PREFIX.length);
  return name;
}

function isDisconnectedWriteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const low = message.toLowerCase();
  return low.includes('not connected') || low.includes('disconnected') || low.includes('device disconnected');
}

export class UnifiedDeviceBleService {
  private currentDevice: Device | null = null;
  private notificationSub: Subscription | null = null;
  private mockCallback: ((notification: PairingNotification) => void) | null = null;
  private debugCallback: ((patch: Partial<BleDebugState>) => void) | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

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
      matchServiceUuid: UNIFIED_SERVICE_UUID,
      namePrefix: WQM_PAIR_NAME_PREFIX,
      mockDevices: [
        { id: 'mock-pair-m1', name: 'WQMPAIR_M1', rssi: -44 },
        { id: 'mock-pair-c1', name: 'WQMPAIR_C1', rssi: -56 },
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
      return { id: deviceId, name: deviceId.startsWith(WQM_PAIR_NAME_PREFIX) ? deviceId : `WQMPAIR_${deviceId}` };
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
    this.writeQueue = Promise.resolve();
    this.stopScan();
    await disconnectDevice(device);
  }

  private clearStaleConnection(error: unknown): void {
    if (!isDisconnectedWriteError(error)) return;
    this.notificationSub?.remove();
    this.notificationSub = null;
    this.currentDevice = null;
    this.writeQueue = Promise.resolve();
    this.emitDebug({ connectedDeviceId: undefined, connectedDeviceName: undefined, lastError: 'Bluetooth disconnected. Please reconnect the device.' });
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

  async writeCommand(command: PairingCommand, options?: { repeatWithoutResponseAfterSuccess?: boolean; preferWithoutResponse?: boolean }): Promise<void> {
    const commandJson = JSON.stringify(command);
    this.emitDebug({ lastCommand: commandJson });
    if (MOCK_BLE_CONFIG) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      this.emitMock(command);
      return;
    }
    if (!this.currentDevice) throw new Error('No WQMPAIR device is connected.');
    const device = this.currentDevice;
    const writeTask = this.writeQueue.then(() => writeJson(device, UNIFIED_SERVICE_UUID, UNIFIED_RX_UUID, command, options));
    this.writeQueue = writeTask.catch(() => undefined);
    try {
      await writeTask;
    } catch (error) {
      this.clearStaleConnection(error);
      throw error;
    }
  }

  async writeCommandEnvelope(cmd: string, args: Record<string, unknown> = {}, options?: { repeatWithoutResponseAfterSuccess?: boolean; preferWithoutResponse?: boolean }): Promise<string> {
    const command = makeBleCommand(cmd, args);
    await this.writeCommand(command, options);
    return command.cmd_id;
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
      console.log('[BLE] Service found:', !!service, UNIFIED_SERVICE_UUID);
      console.log('[BLE] RX found:', rxFound, UNIFIED_RX_UUID);
      console.log('[BLE] TX found:', txFound, UNIFIED_TX_UUID);
      this.emitDebug({ serviceFound: !!service, rxFound, txFound });
    } catch (error) {
      this.emitDebug({ lastError: error instanceof Error ? error.message : String(error) });
    }
  }

  getInfo(): Promise<void> {
    return this.writeCommandEnvelope('info', {}, { repeatWithoutResponseAfterSuccess: true }).then(() => undefined);
  }

  setId(deviceId: string, networkId: string): Promise<void> {
    return this.writeCommandEnvelope('set_id', { device_id: deviceId, network_id: networkId }).then(() => undefined);
  }

  setWifi(ssid: string, password: string, gateway = true): Promise<void> {
    return this.writeCommandEnvelope('set_wifi', { ssid, password, gateway }).then(() => undefined);
  }

  scanWifi(_useAlias = false, maxResults?: number): Promise<void> {
    return this.writeCommandEnvelope(
      'scan_wifi',
      typeof maxResults === 'number' ? { max_results: maxResults } : {},
      { repeatWithoutResponseAfterSuccess: true },
    ).then(() => undefined);
  }

  wifiStatus(): Promise<void> {
    return this.writeCommandEnvelope('wifi_status').then(() => undefined);
  }

  scanParents(): Promise<void> {
    return this.writeCommandEnvelope('scan').then(() => undefined);
  }

  pairNode(parentId: string, role: 'CHILD' | 'RELAY', networkId: string): Promise<void> {
    return this.writeCommandEnvelope('pair', { parent_id: parentId, role, network_id: networkId }, { preferWithoutResponse: true }).then(() => undefined);
  }

  resetPair(): Promise<void> {
    return this.writeCommandEnvelope('reset_pair').then(() => undefined);
  }

  factoryReset(): Promise<void> {
    return this.writeCommandEnvelope('factory').then(() => undefined);
  }

  clearWifi(): Promise<void> {
    return this.writeCommandEnvelope('clear_wifi').then(() => undefined);
  }

  private emitMock(command: PairingCommand): void {
    if (!this.mockCallback) return;
    const args = command.args ?? {};
    if (command.cmd === 'info') {
      this.mockCallback({
        v: 2,
        type: 'info',
        protocol: 'wqm_ble_v2',
        device_id: 'M1',
        network_id: 'POND_001',
        role: 'UNPAIRED',
        switch_mode: 'PAIRING',
        parent_id: '',
        root_gateway_id: '',
        lora_ready: true,
        wifi_connected: false,
        paired: false,
        fw: 'v3.2.17',
        offline_firebase_queue_size: 0,
        offline_queue_ready: true,
        gateway_uplink_queue_size: 0,
        pairing_cloud_queue_size: 0,
        forward_queue_size: 0,
      });
    }
    if (command.cmd === 'set_id') this.mockCallback({ type: 'set_id', ok: true });
    if (command.cmd === 'scan_wifi') {
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
    if (command.cmd === 'wifi_status') this.mockCallback({ type: 'wifi_status', ok: true, wifi_connected: true, ip: '192.168.0.100' });
    if (command.cmd === 'scan') this.mockCallback({ type: 'parents', items: MOCK_PARENTS });
    if (command.cmd === 'pair') {
      const parentId = typeof args.parent_id === 'string' ? args.parent_id : '';
      const role = args.role === 'RELAY' ? 'RELAY' : 'CHILD';
      this.mockCallback({ type: 'pair_started', ok: true, parent_id: parentId, role });
      const selectedParent = MOCK_PARENTS.find((parent) => parent.id === parentId);
      setTimeout(() => this.mockCallback?.({
        type: 'pair_result',
        ok: true,
        stage: 'saved',
        parent_id: parentId,
        root_gateway_id: selectedParent?.root_gateway_id ?? (parentId.startsWith('M') ? parentId : 'M1'),
        auto_promoted: selectedParent?.role === 'RELAY_CANDIDATE',
      }), 600);
      setTimeout(() => this.mockCallback?.({ type: 'server_test', status: 'sent', test_id: `${role}_MOCK_${Date.now()}` }), 1100);
    }
    if (command.cmd === 'reset_pair') this.mockCallback({ type: 'reset_pair', ok: true });
    if (command.cmd === 'factory') this.mockCallback({ type: 'factory', ok: true, message: 'Restarting' });
    if (command.cmd === 'clear_wifi') this.mockCallback({ type: 'clear_wifi', ok: true, message: 'Wi-Fi credentials cleared' });
  }
}

export const unifiedDeviceBleService = new UnifiedDeviceBleService();
