import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function CalibrationStepCard({ title, subtitle, children }: Props) {
  return (
    <Card
      style={{
        borderRadius: radius.xxl,
        ...shadows.card,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Card.Content style={{ padding: spacing.lg }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedStrong, letterSpacing: 0.5 }}>CALIBRATION</Text>
        <Text style={{ marginTop: spacing.sm, fontSize: 20, fontWeight: '900', color: colors.navy, letterSpacing: -0.3 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, lineHeight: 22, fontSize: 15, fontWeight: '500' }}>
            {subtitle}
          </Text>
        ) : null}
        {children ? <View style={{ marginTop: spacing.lg }}>{children}</View> : null}
      </Card.Content>
    </Card>
  );
}
