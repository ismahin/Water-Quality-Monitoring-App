import { Text, View } from 'react-native';
import { colors, radius, spacing } from '../../constants/theme';

const labels = ['Instructions', 'New Device', 'Role', 'Parent', 'Connect', 'Test', 'Done'];

type Props = {
  current: number;
};

export function PairingStepHeader({ current }: Props) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.mutedStrong, fontWeight: '900' }}>Step {current} of {labels.length}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {labels.map((label, index) => (
          <View
            key={label}
            style={{
              paddingHorizontal: 9,
              paddingVertical: 6,
              borderRadius: radius.sm,
              backgroundColor: index + 1 <= current ? '#E0F2FE' : colors.surfaceMuted,
            }}
          >
            <Text style={{ color: colors.navy, fontSize: 11, fontWeight: '800' }}>{index + 1}. {label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

