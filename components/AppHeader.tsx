import { Pressable, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors, layout, spacing } from '../constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Optional wizard progress (e.g. setup flows) */
  wizardStep?: { current: number; total: number };
};

export function AppHeader({ title, subtitle, onBack, right, wizardStep }: Props) {
  return (
    <View style={{ marginBottom: spacing.md, gap: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={layout.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 6 }}
            >
              <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Back</Text>
            </Pressable>
          ) : null}
          <Text style={{ fontSize: 26, fontWeight: '900', color: colors.navy, letterSpacing: -0.4 }}>{title}</Text>
          {subtitle ? (
            <Text style={{ marginTop: 6, color: colors.mutedStrong, fontSize: 15, lineHeight: 22 }}>{subtitle}</Text>
          ) : null}
        </View>
        {right ? <View style={{ paddingTop: onBack ? 0 : 4 }}>{right}</View> : null}
      </View>

      {wizardStep ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.mutedStrong, letterSpacing: 0.4 }}>
              STEP {wizardStep.current} / {wizardStep.total}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
              {Math.round((wizardStep.current / wizardStep.total) * 100)}%
            </Text>
          </View>
          <View style={{ flexDirection: 'row', height: 4, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(wizardStep.current / wizardStep.total) * 100}%`,
                backgroundColor: colors.primary,
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
