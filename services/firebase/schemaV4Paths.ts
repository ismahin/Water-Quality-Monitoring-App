export function safeFirebaseKey(value: string): string {
  return value.replace(/[.#$\[\]/]/g, '_');
}

export function networkDeviceLatestPath(networkId: string, deviceId: string): string {
  return `networks/${safeFirebaseKey(networkId)}/devices/${safeFirebaseKey(deviceId)}/latest`;
}

export function networkDeviceStatusPath(networkId: string, deviceId: string): string {
  return `networks/${safeFirebaseKey(networkId)}/devices/${safeFirebaseKey(deviceId)}/status`;
}

export function networkDeviceIdentityPath(networkId: string, deviceId: string): string {
  return `networks/${safeFirebaseKey(networkId)}/devices/${safeFirebaseKey(deviceId)}/identity`;
}

export function networkDeviceLinkPath(networkId: string, deviceId: string): string {
  return `networks/${safeFirebaseKey(networkId)}/devices/${safeFirebaseKey(deviceId)}/link`;
}

export function networkGatewayChildrenPath(networkId: string, gatewayId: string): string {
  return `networks/${safeFirebaseKey(networkId)}/gateways/${safeFirebaseKey(gatewayId)}/children`;
}

export function networkGatewayChildLatestPath(networkId: string, gatewayId: string, childId: string): string {
  return `${networkGatewayChildrenPath(networkId, gatewayId)}/${safeFirebaseKey(childId)}/latest`;
}

export function networkGatewayChildStatusPath(networkId: string, gatewayId: string, childId: string): string {
  return `${networkGatewayChildrenPath(networkId, gatewayId)}/${safeFirebaseKey(childId)}/status`;
}

export function networkTopologyPath(networkId: string): string {
  return `networks/${safeFirebaseKey(networkId)}/topology`;
}

export function legacyDeviceLatestPath(deviceId: string): string {
  return `devices/${safeFirebaseKey(deviceId)}/latest`;
}

export function legacyDeviceStatusPath(deviceId: string): string {
  return `devices/${safeFirebaseKey(deviceId)}/status`;
}

export function legacyGatewayChildrenPath(gatewayId: string): string {
  return `devices/${safeFirebaseKey(gatewayId)}/children`;
}

export function legacyGatewayNetworkPath(gatewayId: string): string {
  return `devices/${safeFirebaseKey(gatewayId)}/network`;
}
