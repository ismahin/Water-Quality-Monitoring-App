import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, shadows, spacing } from '../constants/theme';
import { StatusChip, type StatusTone } from './StatusChip';

type Props = {
  score: number;
  max?: number;
  statusLabel: string;
  statusTone?: StatusTone;
  /** Short headline under the chip (e.g. pond health summary) */
  summaryLine?: string;
  tips?: string[];
};

export function WaterQualityScoreCard({
  score,
  max = 100,
  statusLabel,
  statusTone = 'success',
  summaryLine = 'Pond is tracking in a healthy range.',
  tips,
}: Props) {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, score / max));
  const dash = c * pct;

  return (
    <Card
      style={{
        borderRadius: radius.xxl,
        ...shadows.card,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.18)',
      }}
    >
      <Card.Content style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.mutedStrong, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>
          WATER QUALITY SCORE
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.lg }}>
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute' }}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={colors.primary}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${c}`}
                strokeLinecap="round"
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            </Svg>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 32, fontWeight: '900', color: colors.navy, letterSpacing: -1 }}>{score}</Text>
              <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>/{max}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <StatusChip label={statusLabel} tone={statusTone} />
            <Text style={{ marginTop: spacing.md, color: colors.navy, fontWeight: '800', fontSize: 16, lineHeight: 22 }}>
              {summaryLine}
            </Text>
            {tips?.length ? (
              <View style={{ marginTop: spacing.sm, gap: 6 }}>
                {tips.slice(0, 2).map((t) => (
                  <Text key={t} style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 20 }}>
                    • {t}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}
