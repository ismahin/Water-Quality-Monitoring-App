import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { Cpu, Radio, Router, Waypoints } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
const roles = [
  {
    key: 'single',
    title: 'Single Device',
    body: 'Standalone Wi‑Fi node with local sensors.',
    icon: Radio,
    href: '/(tabs)/devices',
  },
  {
    key: 'gateway',
    title: 'Gateway / Mother',
    body: 'Wi‑Fi uplink + LoRa downstream for children/relays.',
    icon: Router,
    href: '/device/m1',
  },
  {
    key: 'child',
    title: 'Child Node',
    body: 'Sensors only; joins a parent via LoRa.',
    icon: Cpu,
    href: '/setup/lora-pairing',
  },
  {
    key: 'relay',
    title: 'Relay Node',
    body: 'Sensors + forwarding for a downstream child.',
    icon: Waypoints,
    href: '/setup/lora-pairing',
  },
] as const;

export default function SelectDeviceRoleScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Device role" subtitle="Mock selection updates your next steps" onBack={() => router.back()} />

      <View style={{ gap: spacing.md }}>
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <Pressable key={r.key} onPress={() => router.push(r.href as never)}>
              <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
                <Card.Content style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 16,
                      backgroundColor: '#E0F2FE',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon color={colors.primary} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '900', color: colors.navy }}>{r.title}</Text>
                    <Text style={{ marginTop: 6, color: colors.muted, lineHeight: 20 }}>{r.body}</Text>
                  </View>
                </Card.Content>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}
