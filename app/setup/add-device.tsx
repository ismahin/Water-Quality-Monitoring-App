import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from 'react-native-paper';
import { Radio, Router, Settings2 } from 'lucide-react-native';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';

const options = [
  {
    title: 'Add Single / Gateway Device',
    body: 'Connect by BLE, select Wi-Fi, and complete the gateway setup.',
    icon: Router,
    href: '/setup/gateway-wifi-setup',
  },
  {
    title: 'Add Child / Extend Network',
    body: 'Add a new sensor node under a gateway, relay, or existing child. Existing child devices can automatically become relays.',
    icon: Radio,
    href: '/pairing',
  },
  {
    title: 'Configure Existing Device',
    body: 'Read status, update Wi-Fi, reset pairing, or change network settings.',
    icon: Settings2,
    href: '/setup/pairing-config',
  },
] as const;

export default function AddDeviceScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Add device" subtitle="Choose setup type" onBack={() => router.back()} />

      <View style={{ gap: spacing.md }}>
        {options.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable key={item.title} onPress={() => router.push(item.href as never)}>
              <Card style={{ borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
                <Card.Content style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon color={colors.primary} size={22} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '900', color: colors.navy }}>{item.title}</Text>
                      <Text style={{ marginTop: 6, color: colors.muted, lineHeight: 20 }}>{item.body}</Text>
                    </View>
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
