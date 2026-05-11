export type SignalQuality = 'Excellent' | 'Good' | 'Fair' | 'Weak';

export function wifiQualityFromRssi(rssi: number): SignalQuality {
  if (rssi >= -50) return 'Excellent';
  if (rssi >= -65) return 'Good';
  if (rssi >= -75) return 'Fair';
  return 'Weak';
}

export function loraQualityFromMetrics(input: {
  rssi: number;
  snr: number;
  packetSuccess: number;
}): SignalQuality {
  const { rssi, snr, packetSuccess } = input;
  if (packetSuccess >= 95 && rssi >= -90 && snr >= 6) return 'Excellent';
  if (packetSuccess >= 88 && rssi >= -100 && snr >= 4) return 'Good';
  if (packetSuccess >= 75 && rssi >= -108 && snr >= 2) return 'Fair';
  return 'Weak';
}

export function qualityColor(q: SignalQuality): string {
  switch (q) {
    case 'Excellent':
      return '#10B981';
    case 'Good':
      return '#0EA5E9';
    case 'Fair':
      return '#F59E0B';
    case 'Weak':
      return '#EF4444';
  }
}
