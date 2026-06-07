import { Text, View } from 'react-native';
import { CheckCircle2, Circle, XCircle } from 'lucide-react-native';
import type { PairingProgressState } from '../../types/pairing';
import { colors, spacing } from '../../constants/theme';

type Props = {
  progress: PairingProgressState;
};

const items: Array<[keyof PairingProgressState, string]> = [
  ['bleConnected', 'BLE connected'],
  ['infoLoaded', 'Device info loaded'],
  ['identitySaved', 'Identity saved'],
  ['wifiScanDone', 'Wi-Fi networks scanned'],
  ['wifiSent', 'Wi-Fi credentials sent'],
  ['wifiConnected', 'Wi-Fi connected'],
  ['roleSelected', 'Role selected'],
  ['parentSelected', 'Parent selected'],
  ['pairStarted', 'Pair request sent'],
  ['pairSaved', 'Device saved config'],
  ['serverTestSent', 'Server test sent'],
  ['serverTestConfirmed', 'Server test received in Firebase'],
];

export function PairingProgress({ progress }: Props) {
  return (
    <View style={{ gap: spacing.md }}>
      {items.map(([key, label]) => {
        if (!Object.prototype.hasOwnProperty.call(progress, key)) return null;
        const done = progress[key] === true;
        return (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {done ? <CheckCircle2 size={22} color={colors.success} /> : <Circle size={22} color={colors.border} />}
            <Text style={{ color: colors.navy, fontWeight: '800', flex: 1 }}>{label}</Text>
          </View>
        );
      })}
      {progress.error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <XCircle size={22} color={colors.danger} />
          <Text selectable style={{ color: colors.danger, fontWeight: '800', flex: 1 }}>{progress.error}</Text>
        </View>
      ) : null}
    </View>
  );
}
