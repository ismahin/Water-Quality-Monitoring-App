import { Pressable, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

type Props = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionTitle({ title, actionLabel, onActionPress }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '800',
          color: colors.mutedStrong,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} hitSlop={10}>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
