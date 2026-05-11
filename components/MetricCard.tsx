import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../constants/theme';
import { StatusChip, type StatusTone } from './StatusChip';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

type Props = {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit?: string;
  statusLabel: string;
  statusTone: StatusTone;
  trendDelta?: number;
};

export function MetricCard({ icon, title, value, unit, statusLabel, statusTone, trendDelta }: Props) {
  const showTrend = trendDelta !== undefined && trendDelta !== 0;
  const up = (trendDelta ?? 0) > 0;
  return (
    <Card
      style={{
        borderRadius: radius.xl,
        ...shadows.soft,
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.12)',
      }}
    >
      <Card.Content style={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: '#E0F2FE',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </View>
          {showTrend ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {up ? (
                <TrendingUp size={17} color={colors.success} />
              ) : (
                <TrendingDown size={17} color={colors.danger} />
              )}
              <Text style={{ fontSize: 12, color: colors.mutedStrong, fontWeight: '700' }}>
                {Math.abs(trendDelta ?? 0).toFixed(2)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ marginTop: spacing.md, color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.navy, letterSpacing: -0.6 }}>{value}</Text>
          {unit ? (
            <Text style={{ fontSize: 14, color: colors.mutedStrong, fontWeight: '700' }}>{unit}</Text>
          ) : null}
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <StatusChip label={statusLabel} tone={statusTone} />
        </View>
      </Card.Content>
    </Card>
  );
}
