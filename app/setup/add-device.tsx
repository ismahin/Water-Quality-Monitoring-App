import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { Router, Radio, Waypoints } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
export default function AddDeviceScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Add device" subtitle="Choose how you want to expand your network" onBack={() => router.back()} />

      <Pressable onPress={() => router.push('/setup/scan-device')}>
        <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
              <Router color={colors.primary} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.navy }}>Add New Gateway / Single Device</Text>
              <Text style={{ marginTop: 6, color: colors.muted, lineHeight: 20 }}>
                Wi‑Fi onboarding for a standalone monitor or a LoRa gateway hub.
              </Text>
            </View>
          </View>
        </Card.Content>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/setup/add-child-node')}>
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
              <Radio color={colors.primary} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.navy }}>Add Child Node</Text>
              <Text style={{ marginTop: 6, color: colors.muted, lineHeight: 20 }}>
                Sensor node that sends data to a parent gateway or relay over LoRa.
              </Text>
            </View>
          </View>
        </Card.Content>
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/setup/scan-device')}>
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
              <Waypoints color={colors.primary} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.navy }}>Add Relay Node</Text>
              <Text style={{ marginTop: 6, color: colors.muted, lineHeight: 20 }}>
                Extends coverage: sensors + forwarding for downstream child nodes.
              </Text>
            </View>
          </View>
        </Card.Content>
        </Card>
      </Pressable>
    </AppScreen>
  );
}
