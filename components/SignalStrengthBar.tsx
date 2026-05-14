import { Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import {
  loraQualityFromMetrics,
  qualityColor,
  wifiQualityFromRssi,
  type SignalQuality,
} from '../utils/statusUtils';

type Props = {
  type: 'wifi' | 'lora';
  rssi: number;
  snr?: number;
  packetSuccess?: number;
  showLabels?: boolean;
  /** When true, LoRa link quality bars are hidden; show copy instead (no child packets yet). */
  loraAwaitingChildPackets?: boolean;
};

const order: SignalQuality[] = ['Weak', 'Fair', 'Good', 'Excellent'];

function segmentsForQuality(q: SignalQuality): number {
  return order.indexOf(q) + 1;
}

export function SignalStrengthBar({
  type,
  rssi,
  snr = 0,
  packetSuccess = 100,
  showLabels = true,
  loraAwaitingChildPackets = false,
}: Props) {
  if (type === 'lora' && loraAwaitingChildPackets) {
    return (
      <View>
        {showLabels ? (
          <Text style={{ color: colors.mutedStrong, fontWeight: '700', marginBottom: spacing.sm }}>LoRa link</Text>
        ) : null}
        <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '600', lineHeight: 18 }}>
          No child packets received yet. LoRa initialized only confirms the module — link activity starts after the first
          child uplink.
        </Text>
      </View>
    );
  }

  const quality =
    type === 'wifi'
      ? wifiQualityFromRssi(rssi)
      : loraQualityFromMetrics({ rssi, snr, packetSuccess });
  const active = segmentsForQuality(quality);
  const qc = qualityColor(quality);

  return (
    <View>
      {showLabels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>
            {type === 'wifi' ? 'Wi‑Fi signal' : 'LoRa link'}
          </Text>
          <Text style={{ color: qc, fontWeight: '800' }}>{quality}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: radius.sm,
              backgroundColor: i <= active ? qc : '#E2E8F0',
              opacity: i <= active ? 1 : 0.55,
            }}
          />
        ))}
      </View>
      {type === 'lora' ? (
        <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, fontSize: 12, fontWeight: '600' }}>
          RSSI {rssi} dBm · SNR {snr.toFixed(1)} dB · Packets {packetSuccess}%
        </Text>
      ) : (
        <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, fontSize: 12, fontWeight: '600' }}>
          RSSI {rssi} dBm
        </Text>
      )}
    </View>
  );
}
