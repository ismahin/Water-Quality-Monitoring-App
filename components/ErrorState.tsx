import { Card, Text } from 'react-native-paper';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors, radius, shadows, spacing } from '../constants/theme';

type Tone = 'danger' | 'warning';

const toneStyles: Record<
  Tone,
  { backgroundColor: string; borderColor: string; titleColor: string }
> = {
  danger: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    titleColor: colors.navy,
  },
  warning: {
    backgroundColor: '#FFFBEB',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    titleColor: colors.navy,
  },
};

type Props = {
  title: string;
  message: string;
  tone?: Tone;
  footer?: ReactNode;
};

/** Compact error / warning callout for setup flows (Paper Card + text). */
export function ErrorState({ title, message, tone = 'danger', footer }: Props) {
  const t = toneStyles[tone];
  return (
    <Card
      style={{
        marginTop: spacing.lg,
        borderRadius: radius.xl,
        ...shadows.soft,
        backgroundColor: t.backgroundColor,
        borderWidth: 1,
        borderColor: t.borderColor,
      }}
    >
      <Card.Content style={{ gap: spacing.sm }}>
        <Text style={{ fontWeight: '900', color: t.titleColor }}>{title}</Text>
        <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>{message}</Text>
        {footer ? <View style={{ marginTop: spacing.xs }}>{footer}</View> : null}
      </Card.Content>
    </Card>
  );
}
