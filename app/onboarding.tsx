import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Droplets, Network } from 'lucide-react-native';
import { colors, shadows, spacing } from '../constants/theme';
import { useMockApp } from '../context/MockAppContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';

const slides = [
  {
    key: '1',
    title: 'Monitor Your Pond',
    body: 'pH, TDS, temperature, and turbidity — together in one calm dashboard.',
    icon: Droplets,
  },
  {
    key: '2',
    title: 'Build Your Network',
    body: 'Gateways, relays, and child nodes work together for wide coverage.',
    icon: Network,
  },
  {
    key: '3',
    title: 'Stay Protected',
    body: 'Alerts, calibration, diagnostics, and history keep operations predictable.',
    icon: Bell,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setHasCompletedOnboarding } = useMockApp();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await setHasCompletedOnboarding(true);
    router.replace('/login');
  };

  return (
    <LinearGradient colors={['#E0F2FE', '#F8FAFC']} style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(i) => i.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        renderItem={({ item }) => {
          const Icon = item.icon;
          return (
            <View style={{ width, paddingHorizontal: spacing.lg, paddingTop: 72, paddingBottom: 24 }}>
              <View
                style={{
                  height: 220,
                  borderRadius: 28,
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...shadows.elevated,
                  borderWidth: 1,
                  borderColor: 'rgba(14, 165, 233, 0.12)',
                }}
              >
                <View
                  style={{
                    width: 86,
                    height: 86,
                    borderRadius: 28,
                    backgroundColor: '#E0F2FE',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={40} color={colors.primary} />
                </View>
              </View>
              <Text style={{ marginTop: spacing.xl, fontSize: 26, fontWeight: '900', color: colors.navy, letterSpacing: -0.3 }}>
                {item.title}
              </Text>
              <Text style={{ marginTop: spacing.md, color: colors.mutedStrong, fontSize: 15, lineHeight: 24, fontWeight: '600' }}>
                {item.body}
              </Text>
            </View>
          );
        }}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 28, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          {slides.map((s, i) => (
            <View
              key={s.key}
              style={{
                width: i === index ? 18 : 8,
                height: 8,
                borderRadius: 8,
                backgroundColor: i === index ? colors.primary : '#CBD5E1',
              }}
            />
          ))}
        </View>
        {index < slides.length - 1 ? (
          <PrimaryButton
            label="Next"
            onPress={() => {
              const next = Math.min(slides.length - 1, index + 1);
              listRef.current?.scrollToOffset({ offset: width * next, animated: true });
              setIndex(next);
            }}
          />
        ) : (
          <PrimaryButton label="Get started" onPress={finish} />
        )}
        <SecondaryButton label="Skip" onPress={finish} />
      </View>
    </LinearGradient>
  );
}
