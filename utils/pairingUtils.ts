import type { DeviceLatest, DeviceStatus, NetworkDevice, TopologyNode } from '../types/networkDevice';
import type { PairingDeviceRole, PairingParent } from '../types/pairing';

export const DEFAULT_NETWORK_ID = 'POND_001';

export function safeKey(value: string): string {
  return value.replace(/[.#$\[\]/]/g, '_');
}

export function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function toBoolValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

export function formatAgo(value?: number | string): string {
  if (!value) return 'Unknown';
  const ms = typeof value === 'number' ? (value < 10_000_000_000 ? value : value) : new Date(value).getTime();
  const timestamp = typeof value === 'number' && value < 10_000_000_000 ? Date.now() - value : ms;
  if (!Number.isFinite(timestamp)) return 'Unknown';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function formatSignalQuality(rssi?: number): 'Excellent' | 'Good' | 'Weak' | 'Poor' | 'Unknown' {
  if (typeof rssi !== 'number') return 'Unknown';
  if (rssi >= -50) return 'Excellent';
  if (rssi >= -70) return 'Good';
  if (rssi >= -90) return 'Weak';
  return 'Poor';
}

export function normalizeRole(value: unknown): PairingDeviceRole {
  const role = typeof value === 'string' ? value.toUpperCase() : '';
  if (role === 'GATEWAY' || role === 'RELAY' || role === 'CHILD' || role === 'UNPAIRED' || role === 'RELAY_CANDIDATE') return role;
  return 'SINGLE';
}

export function normalizeDeviceLatest(raw: unknown): DeviceLatest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    v: toNumber(o.v),
    protocol: toStringValue(o.protocol),
    fw: toStringValue(o.fw),
    firmware_version: toStringValue(o.firmware_version),
    fw_version: toStringValue(o.fw_version),
    schema_version: toNumber(o.schema_version),
    device_id: toStringValue(o.device_id),
    source_id: toStringValue(o.source_id),
    role: normalizeRole(o.role),
    lifecycle_state: toStringValue(o.lifecycle_state),
    link_state: toStringValue(o.link_state),
    network_id: toStringValue(o.network_id),
    parent_id: toStringValue(o.parent_id),
    root_gateway_id: toStringValue(o.root_gateway_id),
    gateway_id: toStringValue(o.gateway_id),
    current_hop_parent_id: toStringValue(o.current_hop_parent_id),
    forwarded_by: toStringValue(o.forwarded_by),
    route: toStringValue(o.route),
    ph: toNumber(o.ph),
    tds: toNumber(o.tds ?? o.td),
    temperature: toNumber(o.temperature ?? o.temp ?? o.tm),
    turbidity: toNumber(o.turbidity ?? o.tb),
    battery: toNumber(o.battery ?? o.bt),
    rc: toNumber(o.rc ?? o.rx_direct_count ?? o.source_rx_count),
    tc: toNumber(o.tc ?? o.tx_packet_count ?? o.source_tx_count),
    fc: toNumber(o.fc ?? o.forward_packet_count ?? o.source_forward_count),
    kc: toNumber(o.kc ?? o.known_device_count ?? o.source_known_count),
    seq: toNumber(o.seq),
    sid: toNumber(o.sid),
    rx_direct_count: toNumber(o.rx_direct_count),
    tx_packet_count: toNumber(o.tx_packet_count),
    forward_packet_count: toNumber(o.forward_packet_count),
    known_device_count: toNumber(o.known_device_count),
    direct_child_count: toNumber(o.direct_child_count),
    gateway_upload_count: toNumber(o.gateway_upload_count),
    own_upload_count: toNumber(o.own_upload_count),
    source_rx_count: toNumber(o.source_rx_count),
    source_tx_count: toNumber(o.source_tx_count),
    source_forward_count: toNumber(o.source_forward_count),
    source_known_count: toNumber(o.source_known_count),
    timestamp: toNumber(o.timestamp),
    last_upload_ms: toNumber(o.last_upload_ms),
    last_seen_ms: toNumber(o.last_seen_ms ?? o.last_upload_ms ?? o.updated_at),
    rssi: toNumber(o.rssi ?? o.last_lora_rssi ?? o.child_rssi ?? o.gateway_rssi),
    snr: toNumber(o.snr ?? o.last_lora_snr ?? o.child_snr ?? o.gateway_snr),
    child_rssi: toNumber(o.child_rssi),
    child_snr: toNumber(o.child_snr),
    gateway_rssi: toNumber(o.gateway_rssi),
    gateway_snr: toNumber(o.gateway_snr),
    wifi_connected: toBoolValue(o.wifi_connected),
    wifi_ssid: toStringValue(o.wifi_ssid),
    wifi_rssi: toNumber(o.wifi_rssi),
    ip: toStringValue(o.ip),
    switch_mode: toStringValue(o.switch_mode),
    lora_ready: toBoolValue(o.lora_ready),
    lora_error: toStringValue(o.lora_error),
    lora_packet_count: toNumber(o.lora_packet_count),
    uptime_ms: toNumber(o.uptime_ms),
    pair_confirmed: toBoolValue(o.pair_confirmed),
    telemetry_received: toBoolValue(o.telemetry_received),
    waiting_for_first_data: toBoolValue(o.waiting_for_first_data),
    offline_firebase_queue_size: toNumber(o.offline_firebase_queue_size),
    offline_queue_ready: toBoolValue(o.offline_queue_ready),
    forward_queue_size: toNumber(o.forward_queue_size ?? o.forward_queue),
    gateway_uplink_queue_size: toNumber(o.gateway_uplink_queue_size ?? o.gateway_uplink_queue),
    gateway_uplink_queue: toNumber(o.gateway_uplink_queue),
    pairing_cloud_queue_size: toNumber(o.pairing_cloud_queue_size ?? o.pairing_cloud_queue),
    pairing_cloud_queue: toNumber(o.pairing_cloud_queue),
  };
}

export function normalizeStatus(raw: unknown): DeviceStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    v: toNumber(o.v),
    protocol: toStringValue(o.protocol),
    fw: toStringValue(o.fw),
    firmware_version: toStringValue(o.firmware_version),
    fw_version: toStringValue(o.fw_version),
    fw_seen_by: toStringValue(o.fw_seen_by),
    schema_version: toNumber(o.schema_version),
    device_id: toStringValue(o.device_id),
    online: toBoolValue(o.online),
    role: normalizeRole(o.role),
    link_state: toStringValue(o.link_state),
    parent_id: toStringValue(o.parent_id),
    root_gateway_id: toStringValue(o.root_gateway_id),
    gateway_id: toStringValue(o.gateway_id),
    current_hop_parent_id: toStringValue(o.current_hop_parent_id),
    forwarded_by: toStringValue(o.forwarded_by),
    route: toStringValue(o.route),
    network_id: toStringValue(o.network_id),
    last_seen_ms: toNumber(o.last_seen_ms ?? o.last_upload_ms ?? o.updated_at),
    updated_at: toNumber(o.updated_at),
    last_upload_ms: toNumber(o.last_upload_ms),
    battery: toNumber(o.battery),
    rssi: toNumber(o.rssi ?? o.last_lora_rssi ?? o.child_rssi ?? o.gateway_rssi ?? o.pair_rssi),
    snr: toNumber(o.snr ?? o.last_lora_snr ?? o.child_snr ?? o.gateway_snr ?? o.pair_snr),
    child_rssi: toNumber(o.child_rssi),
    child_snr: toNumber(o.child_snr),
    gateway_rssi: toNumber(o.gateway_rssi),
    gateway_snr: toNumber(o.gateway_snr),
    seq: toNumber(o.seq),
    sid: toNumber(o.sid),
    rx_direct_count: toNumber(o.rx_direct_count),
    tx_packet_count: toNumber(o.tx_packet_count),
    forward_packet_count: toNumber(o.forward_packet_count),
    known_device_count: toNumber(o.known_device_count),
    direct_child_count: toNumber(o.direct_child_count),
    gateway_upload_count: toNumber(o.gateway_upload_count),
    own_upload_count: toNumber(o.own_upload_count),
    source_rx_count: toNumber(o.source_rx_count),
    source_tx_count: toNumber(o.source_tx_count),
    source_forward_count: toNumber(o.source_forward_count),
    source_known_count: toNumber(o.source_known_count),
    pair_stage: toStringValue(o.pair_stage),
    pair_accepted: toBoolValue(o.pair_accepted),
    pair_confirmed: toBoolValue(o.pair_confirmed),
    telemetry_received: toBoolValue(o.telemetry_received),
    waiting_for_first_data: toBoolValue(o.waiting_for_first_data),
    lifecycle_state: toStringValue(o.lifecycle_state),
    message: toStringValue(o.message),
    command_stream: toStringValue(o.command_stream),
    wifi_connected: toBoolValue(o.wifi_connected),
    wifi_ssid: toStringValue(o.wifi_ssid),
    wifi_rssi: toNumber(o.wifi_rssi),
    ip: toStringValue(o.ip),
    switch_mode: toStringValue(o.switch_mode),
    lora_ready: toBoolValue(o.lora_ready),
    lora_error: toStringValue(o.lora_error),
    lora_packet_count: toNumber(o.lora_packet_count),
    gateway_uplink_enabled: toBoolValue(o.gateway_uplink_enabled),
    relay_enabled: toBoolValue(o.relay_enabled),
    offline_firebase_queue_size: toNumber(o.offline_firebase_queue_size),
    offline_queue_ready: toBoolValue(o.offline_queue_ready),
    forward_queue_size: toNumber(o.forward_queue_size ?? o.forward_queue),
    forward_queue: toNumber(o.forward_queue),
    gateway_uplink_queue_size: toNumber(o.gateway_uplink_queue_size ?? o.gateway_uplink_queue),
    gateway_uplink_queue: toNumber(o.gateway_uplink_queue),
    pairing_cloud_queue_size: toNumber(o.pairing_cloud_queue_size ?? o.pairing_cloud_queue),
    pairing_cloud_queue: toNumber(o.pairing_cloud_queue),
    has_ever_paired: toBoolValue(o.has_ever_paired),
  };
}

export function isOnline(lastSeenMs?: number, explicitOnline?: boolean): boolean | null {
  if (explicitOnline === false) return false;
  if (!lastSeenMs) return explicitOnline ?? null;
  const timestamp = lastSeenMs < 10_000_000_000 ? Date.now() - lastSeenMs : lastSeenMs;
  return Date.now() - timestamp <= 60_000;
}

export function buildNetworkDevice(id: string, raw: unknown): NetworkDevice {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const identity = o.identity && typeof o.identity === 'object' ? (o.identity as Record<string, unknown>) : undefined;
  const latest = normalizeDeviceLatest(o.latest ?? o);
  const status = normalizeStatus(o.status ?? (o.latest ? undefined : o));
  const role = normalizeRole(status?.role ?? latest?.role ?? identity?.role);
  const childObj = o.children && typeof o.children === 'object' ? o.children : undefined;
  const hasChildren = !!childObj && Object.keys(childObj).length > 0;
  const directChildCount = status?.direct_child_count ?? latest?.direct_child_count;
  const displayRole: PairingDeviceRole = role === 'SINGLE' && (hasChildren || (directChildCount ?? 0) > 0) ? 'GATEWAY' : role;
  const lastSeenMs = status?.last_seen_ms ?? latest?.last_seen_ms ?? latest?.timestamp;
  return {
    id: latest?.device_id ?? status?.device_id ?? toStringValue(identity?.device_id) ?? id,
    latest,
    status,
    displayRole,
    online: isOnline(lastSeenMs, status?.online),
    lastSeenMs,
    hasChildren: hasChildren || (directChildCount ?? 0) > 0,
    source: o.latest || o.status || o.identity ? 'device' : 'pairingRequest',
  };
}

export function buildTopologyTree(nodes: Record<string, TopologyNode>): TopologyNode[] {
  const byId = new Map<string, TopologyNode>();
  Object.entries(nodes).forEach(([key, node]) => {
    const id = node.device_id || key;
    byId.set(id, { ...node, device_id: id, children: [] });
  });

  const roots: TopologyNode[] = [];
  byId.forEach((node) => {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent && parent.device_id !== node.device_id) parent.children = [...(parent.children ?? []), node];
    else roots.push(node);
  });

  const sortTree = (items: TopologyNode[]) => {
    items.sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || a.device_id.localeCompare(b.device_id));
    items.forEach((item) => sortTree(item.children ?? []));
  };
  sortTree(roots);
  return roots;
}

function utf8ToBinary(value: string): string {
  return encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function binaryToUtf8(value: string): string {
  return decodeURIComponent(
    value
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
}

export function encodeBleCommand(command: unknown): string {
  return btoa(utf8ToBinary(JSON.stringify(command)));
}

export function decodeBleText(base64Value?: string | null): string | null {
  if (!base64Value) return null;
  try {
    return binaryToUtf8(atob(base64Value));
  } catch {
    return null;
  }
}

export function decodeBleValue<T = unknown>(base64Value?: string | null): T | null {
  const decoded = decodeBleText(base64Value);
  if (!decoded) return null;
  try {
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function filterCompatibleParents(
  parents: PairingParent[],
  networkId: string,
  newDeviceId: string,
): PairingParent[] {
  const deduped = new Map<string, PairingParent>();
  for (const parent of parents) {
    if (parent.network_id !== networkId) continue;
    if ((parent.age_ms ?? 0) > 10_000) continue;
    if (parent.id === newDeviceId) continue;
    const existing = deduped.get(parent.id);
    if (!existing || (parent.rssi ?? -120) > (existing.rssi ?? -120)) deduped.set(parent.id, parent);
  }
  return Array.from(deduped.values()).sort((a, b) => (b.rssi ?? -120) - (a.rssi ?? -120));
}
