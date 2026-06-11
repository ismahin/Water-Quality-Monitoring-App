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
    device_id: toStringValue(o.device_id),
    role: normalizeRole(o.role),
    network_id: toStringValue(o.network_id),
    parent_id: toStringValue(o.parent_id),
    root_gateway_id: toStringValue(o.root_gateway_id),
    route: toStringValue(o.route),
    ph: toNumber(o.ph),
    tds: toNumber(o.tds ?? o.td),
    temperature: toNumber(o.temperature ?? o.temp ?? o.tm),
    turbidity: toNumber(o.turbidity ?? o.tb),
    battery: toNumber(o.battery ?? o.bt),
    rc: toNumber(o.rc),
    tc: toNumber(o.tc),
    fc: toNumber(o.fc),
    kc: toNumber(o.kc),
    timestamp: toNumber(o.timestamp),
    last_seen_ms: toNumber(o.last_seen_ms),
    rssi: toNumber(o.rssi ?? o.last_lora_rssi),
    snr: toNumber(o.snr ?? o.last_lora_snr),
  };
}

export function normalizeStatus(raw: unknown): DeviceStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    online: typeof o.online === 'boolean' ? o.online : undefined,
    role: normalizeRole(o.role),
    parent_id: toStringValue(o.parent_id),
    root_gateway_id: toStringValue(o.root_gateway_id),
    network_id: toStringValue(o.network_id),
    last_seen_ms: toNumber(o.last_seen_ms ?? o.last_upload_ms),
    battery: toNumber(o.battery),
    rssi: toNumber(o.rssi ?? o.last_lora_rssi),
    snr: toNumber(o.snr ?? o.last_lora_snr),
    pair_stage: toStringValue(o.pair_stage),
    pair_confirmed: typeof o.pair_confirmed === 'boolean' ? o.pair_confirmed : undefined,
    telemetry_received: typeof o.telemetry_received === 'boolean' ? o.telemetry_received : undefined,
    lifecycle_state: toStringValue(o.lifecycle_state),
    message: toStringValue(o.message),
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
  const latest = normalizeDeviceLatest(o.latest ?? o);
  const status = normalizeStatus(o.status);
  const role = normalizeRole(status?.role ?? latest?.role);
  const childObj = o.children && typeof o.children === 'object' ? o.children : undefined;
  const displayRole: PairingDeviceRole = role === 'SINGLE' && childObj && Object.keys(childObj).length > 0 ? 'GATEWAY' : role;
  const lastSeenMs = status?.last_seen_ms ?? latest?.last_seen_ms ?? latest?.timestamp;
  return {
    id: latest?.device_id ?? id,
    latest,
    status,
    displayRole,
    online: isOnline(lastSeenMs, status?.online),
    lastSeenMs,
    hasChildren: !!childObj && Object.keys(childObj).length > 0,
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
