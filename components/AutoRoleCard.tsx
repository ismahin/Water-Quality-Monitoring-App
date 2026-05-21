import { Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { Cpu, Radio, Router, Waypoints } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../constants/theme';
import type { UniversalRole } from '../types/universalDevice';
import { NetworkRoleChip } from './NetworkRoleChip';

type Props = {
  role?: UniversalRole | string;
  hardwareMode?: string;
  gatewayUplinkEnabled?: boolean;
  relayEnabled?: boolean;
  compact?: boolean;
};

export function AutoRoleCard({ role = 'UNCONFIGURED', hardwareMode, gatewayUplinkEnabled, relayEnabled, compact }: Props) {
  const Icon =
    role === 'GATEWAY' ? Router : role === 'RELAY' ? Waypoints : role === 'CHILD' ? Cpu : Radio;
  const singleForced = hardwareMode === 'SINGLE';
  return (
    <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Card.Content style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>Auto-role status</Text>
            <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <NetworkRoleChip role={role} />
              {hardwareMode ? <NetworkRoleChip role={hardwareMode} /> : null}
            </View>
          </View>
        </View>
        {!compact ? (
          <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
            Toggle SINGLE forces standalone mode. Toggle NETWORK auto-selects Gateway when gateway uplink is enabled and Wi-Fi is connected, Relay when relay is enabled, otherwise Child.
          </Text>
        ) : null}
        {singleForced && (gatewayUplinkEnabled || relayEnabled) ? (
          <Text style={{ color: colors.warning, fontWeight: '800', lineHeight: 20 }}>
            Toggle is in SINGLE mode. Network role will activate when switched to NETWORK.
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}
