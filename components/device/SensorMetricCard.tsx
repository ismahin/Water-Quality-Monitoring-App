import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';

type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function SensorMetricCard({ label, value, hint }: Props) {
  return (
    <Card style={{ flex: 1, minWidth: 140, borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.soft }}>
      <Card.Content>
        <Text style={{ color: colors.mutedStrong, fontSize: 12, fontWeight: '800' }}>{label}</Text>
        <Text selectable style={{ marginTop: spacing.xs, color: colors.navy, fontSize: 22, fontWeight: '900' }}>
          {value}
        </Text>
        {hint ? <Text style={{ marginTop: 2, color: colors.muted, fontSize: 12 }}>{hint}</Text> : null}
      </Card.Content>
    </Card>
  );
}

