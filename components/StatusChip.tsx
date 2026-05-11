import { Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted' | 'info';

const toneMap: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: '#DCFCE7', fg: colors.success },
  warning: { bg: '#FEF3C7', fg: colors.warning },
  danger: { bg: '#FEE2E2', fg: colors.danger },
  muted: { bg: '#F1F5F9', fg: colors.mutedStrong },
  info: { bg: '#E0F2FE', fg: colors.primary },
};

type Props = {
  label: string;
  tone: StatusTone;
};

export function StatusChip({ label, tone }: Props) {
  const t = toneMap[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: t.bg,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.md,
      }}
    >
      <Text style={{ color: t.fg, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </View>
  );
}
