import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../constants/theme';

type Props = {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function SetupStepCard({ step, totalSteps, title, description, children }: Props) {
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
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.sm }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 4,
                backgroundColor: i < step ? colors.primary : colors.border,
                opacity: i < step ? 1 : 0.55,
              }}
            />
          ))}
        </View>
        <Text style={{ color: colors.mutedStrong, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>
          STEP {step} OF {totalSteps}
        </Text>
        <Text style={{ marginTop: spacing.sm, fontSize: 21, fontWeight: '900', color: colors.navy, letterSpacing: -0.3 }}>
          {title}
        </Text>
        {description ? (
          <Text style={{ marginTop: spacing.sm, color: colors.mutedStrong, lineHeight: 22, fontSize: 15 }}>
            {description}
          </Text>
        ) : null}
        {children ? <View style={{ marginTop: spacing.lg }}>{children}</View> : null}
      </Card.Content>
    </Card>
  );
}
