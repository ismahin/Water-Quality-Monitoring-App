import { Text, View } from 'react-native';
import { Battery, BatteryLow, BatteryWarning } from 'lucide-react-native';
import { colors, spacing } from '../constants/theme';

type Props = {
  percent: number;
  compact?: boolean;
};

export function BatteryIndicator({ percent, compact }: Props) {
  const critical = percent <= 10;
  const low = percent <= 25;
  const Icon = critical ? BatteryWarning : low ? BatteryLow : Battery;
  const tint = critical ? colors.danger : low ? colors.warning : colors.mutedStrong;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Icon size={compact ? 16 : 18} color={tint} />
      <Text style={{ color: colors.navy, fontWeight: '700', fontSize: compact ? 12 : 13 }}>
        {Math.round(percent)}%
      </Text>
    </View>
  );
}
