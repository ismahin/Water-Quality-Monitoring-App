import { Text, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import type { PairingParent } from '../../types/pairing';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { formatSignalQuality } from '../../utils/pairingUtils';
import { PrimaryButton } from '../PrimaryButton';

type Props = {
  parent: PairingParent;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function ParentDeviceCard({ parent, selected, disabled, onSelect }: Props) {
  const full = parent.child_count >= parent.max_children;
  return (
    <Card
      style={{
        borderRadius: radius.lg,
        backgroundColor: selected ? '#ECFDF5' : colors.card,
        borderWidth: 1,
        borderColor: selected ? 'rgba(16,185,129,0.45)' : colors.border,
        opacity: disabled || full ? 0.55 : 1,
        ...shadows.soft,
      }}
    >
      <Card.Content style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>{parent.id}</Text>
            <Text style={{ marginTop: 4, color: colors.mutedStrong, fontWeight: '700' }}>
              {parent.role} · Network {parent.network_id}
            </Text>
          </View>
          <Chip compact style={{ backgroundColor: '#E0F2FE' }} textStyle={{ fontWeight: '800', fontSize: 11 }}>
            {formatSignalQuality(parent.rssi)}
          </Chip>
        </View>
        <Text style={{ color: colors.mutedStrong }}>Root {parent.root_gateway_id} · Parent {parent.parent_id || '-'} · Depth {parent.depth}</Text>
        <Text style={{ color: colors.mutedStrong }}>Children {parent.child_count}/{parent.max_children} · RSSI {parent.rssi ?? '-'} · SNR {parent.snr ?? '-'}</Text>
        <Text style={{ color: colors.muted }}>Age {Math.round((parent.age_ms ?? 0) / 1000)} sec</Text>
        <PrimaryButton
          label={full ? 'Parent Full' : selected ? 'Selected Parent' : 'Connect to this parent'}
          disabled={disabled || full}
          onPress={onSelect}
        />
      </Card.Content>
    </Card>
  );
}

