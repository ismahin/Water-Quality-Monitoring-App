import { View } from 'react-native';
import { Chip } from 'react-native-paper';
import { colors } from '../constants/theme';

type Props = {
  live: boolean;
  connected?: boolean;
  demoLabel?: string;
};

export function FirebaseLiveBadge({ live, connected, demoLabel = 'Demo Mode' }: Props) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <Chip
        compact
        style={{ backgroundColor: live ? '#DCFCE7' : colors.surfaceMuted, height: 28 }}
        textStyle={{ fontWeight: '900', fontSize: 11, color: live ? colors.success : colors.mutedStrong }}
      >
        {live ? 'Live Firebase' : demoLabel}
      </Chip>
      {live && typeof connected === 'boolean' ? (
        <Chip
          compact
          style={{ backgroundColor: connected ? '#ECFDF5' : '#FFFBEB', height: 28 }}
          textStyle={{ fontWeight: '800', fontSize: 11, color: connected ? colors.success : colors.warning }}
        >
          Firebase {connected ? 'connected' : 'disconnected'}
        </Chip>
      ) : null}
    </View>
  );
}
