import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Chip, FAB } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import { Battery, Wifi } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { mockPhTrend } from '../../constants/mockData';
import { isFirebaseConfigured } from '../../constants/env';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import { formatRelativeTime } from '../../utils/formatTime';
import {
  phStatusLabel,
  tempStatusLabel,
  tdsStatusLabel,
  turbidityStatusLabel,
} from '../../utils/sensorUtils';
import { usesWifiUi, type GatewayDevice, type SingleDevice } from '../../types/device';
import { AppScreen } from '../../components/AppScreen';
import { DeviceStatusCard } from '../../components/DeviceStatusCard';
import { LoRaStatusCard } from '../../components/LoRaStatusCard';
import { MetricCard } from '../../components/MetricCard';
import { SectionTitle } from '../../components/SectionTitle';
import { SensorChart } from '../../components/SensorChart';
import { StatusChip, type StatusTone } from '../../components/StatusChip';
import { WaterQualityScoreCard } from '../../components/WaterQualityScoreCard';
import { CctvHeaderCarousel } from '../../components/CctvHeaderCarousel';
import { Droplets, Gauge, ThermometerSun, Waves } from 'lucide-react-native';

function DashboardHeaderBackground() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 360 220"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Defs>
        <LinearGradient id="dashboardHeaderSky" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E0F2FE" />
          <Stop offset="0.52" stopColor="#CFFAFE" />
          <Stop offset="1" stopColor="#F8FAFC" />
        </LinearGradient>
        <LinearGradient id="dashboardHeaderWater" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#075985" stopOpacity="0.8" />
          <Stop offset="0.56" stopColor="#0EA5E9" stopOpacity="0.72" />
          <Stop offset="1" stopColor="#14B8A6" stopOpacity="0.58" />
        </LinearGradient>
      </Defs>
      <Rect width="360" height="220" fill="url(#dashboardHeaderSky)" />
      <Path
        d="M0 134 L58 72 L82 96 L128 50 L176 118 L226 60 L272 106 L319 70 L360 112 L360 220 L0 220 Z"
        fill="#0F172A"
        opacity="0.8"
      />
      <Path
        d="M58 72 L82 96 L69 91 L128 50 L109 91 L176 118 L226 60 L209 102 L272 106 L319 70 L306 104 L360 112 L360 146 L0 146 Z"
        fill="#F97316"
        opacity="0.34"
      />
      <Path
        d="M0 146 C42 136 88 145 132 137 C182 128 222 146 267 138 C310 130 335 139 360 134 L360 220 L0 220 Z"
        fill="url(#dashboardHeaderWater)"
      />
      <Path
        d="M0 170 C52 154 91 175 135 162 C178 149 219 171 260 158 C299 146 332 154 360 145"
        stroke="#FFFFFF"
        strokeOpacity="0.46"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M0 92 C44 64 82 91 125 74 C174 55 198 43 250 64 C292 81 318 62 360 42 L360 0 L0 0 Z"
        fill="#FFFFFF"
        opacity="0.18"
      />
      <Path
        d="M212 54 C232 42 253 43 272 57 C284 66 301 69 321 59"
        stroke="#0EA5E9"
        strokeOpacity="0.26"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M224 75 C245 62 266 64 286 78 C298 87 315 88 335 78"
        stroke="#06B6D4"
        strokeOpacity="0.24"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="314" cy="38" r="28" fill="#FFFFFF" opacity="0.38" />
      <Circle cx="70" cy="54" r="7" fill="#0EA5E9" opacity="0.22" />
      <Circle cx="91" cy="74" r="4" fill="#14B8A6" opacity="0.22" />
      <Circle cx="48" cy="92" r="5" fill="#06B6D4" opacity="0.18" />
    </Svg>
  );
}

function toneForPh(ph: number): StatusTone {
  const s = phStatusLabel(ph);
  if (s === 'Normal') return 'success';
  return 'warning';
}

function toneForTds(ppm: number): StatusTone {
  return tdsStatusLabel(ppm) === 'Normal' ? 'success' : 'warning';
}

function toneForTemp(c: number): StatusTone {
  const s = tempStatusLabel(c);
  if (s === 'Comfortable' || s === 'Cool') return 'success';
  if (s === 'Warm') return 'warning';
  return 'danger';
}

function toneForTurb(ntu: number): StatusTone {
  const s = turbidityStatusLabel(ntu);
  if (s === 'Clear' || s === 'Normal') return 'success';
  if (s === 'Slightly Cloudy') return 'warning';
  return 'danger';
}

function pondScoreUi(health: 'good' | 'warning' | 'critical'): {
  label: string;
  tone: StatusTone;
  summary: string;
} {
  if (health === 'good') {
    return {
      label: 'Good',
      tone: 'success',
      summary: 'Pond is tracking in a healthy range.',
    };
  }
  if (health === 'warning') {
    return {
      label: 'Watch',
      tone: 'warning',
      summary: 'Review sensors and downstream nodes soon.',
    };
  }
  return {
    label: 'Critical',
    tone: 'danger',
    summary: 'Immediate attention recommended for this pond.',
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, ponds, devices, alerts, registeredDevices, cctvCameras, getLiveSnapshot, firebaseRtdbConnected } = useMockApp();
  const [pondId, setPondId] = useState('pond-a');
  const pond = useMemo(() => ponds.find((p) => p.id === pondId) ?? ponds[0], [pondId, ponds]);
  const pondDevices = useMemo(() => devices.filter((d) => pond.deviceIds.includes(d.id)), [devices, pond.deviceIds]);
  const gateway = useMemo(() => {
    const ids = pond.deviceIds;
    return (
      devices.find((d) => ids.includes(d.id) && d.role === 'gateway') ??
      devices.find((d) => ids.includes(d.id) && d.role === 'single') ??
      devices.find((d) => ids.includes(d.id))
    );
  }, [devices, pond.deviceIds]);

  const liveReg = registeredDevices[0];
  const liveSnap = liveReg ? getLiveSnapshot(liveReg.deviceId) : undefined;
  const liveHasAnyFirebase = !!(liveSnap?.latest || liveSnap?.status);
  const showLiveFirebaseUi = !!liveReg && isFirebaseConfigured();
  const liveContextDevice = liveReg ? devices.find((d) => d.id === liveReg.deviceId && d.isLive) ?? null : null;
  const contextHasTelemetry =
    !!liveContextDevice &&
    (liveContextDevice.sensors.ph !== 0 ||
      liveContextDevice.sensors.tdsPpm !== 0 ||
      liveContextDevice.sensors.temperatureC !== 0 ||
      liveContextDevice.sensors.turbidityNtu !== 0 ||
      liveContextDevice.online !== 'offline');
  const dataSourceIsLive = showLiveFirebaseUi && (liveHasAnyFirebase || contextHasTelemetry);
  const waitingForTelemetry = showLiveFirebaseUi && !liveHasAnyFirebase && !contextHasTelemetry;

  const telemetryDevice = useMemo(() => {
    if (showLiveFirebaseUi && liveReg) {
      return liveContextDevice;
    }
    return gateway ?? null;
  }, [showLiveFirebaseUi, liveReg, liveContextDevice, gateway]);

  const statusDevice = useMemo(() => {
    if (showLiveFirebaseUi && liveReg) {
      return liveContextDevice;
    }
    return gateway ?? null;
  }, [showLiveFirebaseUi, liveReg, liveContextDevice, gateway]);

  const liveWifi = telemetryDevice && usesWifiUi(telemetryDevice) ? (telemetryDevice as SingleDevice | GatewayDevice) : null;

  const net = useMemo(
    () => ({
      gateways: pondDevices.filter((d) => d.role === 'gateway').length,
      relays: pondDevices.filter((d) => d.role === 'relay').length,
      children: pondDevices.filter((d) => d.role === 'child').length,
      singles: pondDevices.filter((d) => d.role === 'single').length,
      active: pondDevices.filter((d) => d.online === 'online' || d.online === 'warning').length,
    }),
    [pondDevices],
  );

  const pondAlerts = useMemo(() => alerts.filter((a) => a.pondId === pond.id && !a.resolved).slice(0, 3), [alerts, pond.id]);
  const scoreUi = useMemo(() => pondScoreUi(pond.healthStatus), [pond.healthStatus]);

  const s = telemetryDevice?.sensors;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const fabBottom = Math.max(insets.bottom, spacing.md) + 56;
  const scrollBottomPad = fabBottom + spacing.xl;

  return (
    <AppScreen contentStyle={{ paddingBottom: scrollBottomPad }}>
      <View
        style={{
          marginHorizontal: -spacing.md,
          marginTop: -spacing.sm,
          marginBottom: spacing.md,
          backgroundColor: '#E0F2FE',
        }}
      >
        <View
          style={{
            height: 164,
            overflow: 'hidden',
            borderBottomLeftRadius: radius.xxl,
            borderBottomRightRadius: radius.xxl,
          }}
        >
          <CctvHeaderCarousel cameras={cctvCameras} fallback={<DashboardHeaderBackground />} />
        </View>
        <View
          style={{
            marginTop: -34,
            minHeight: 156,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
            backgroundColor: colors.card,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            ...shadows.soft,
          }}
        >
          <View style={{ alignSelf: 'center', width: 48, height: 4, borderRadius: 999, backgroundColor: colors.border, marginBottom: spacing.md }} />
          <View style={{ gap: spacing.md }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.navy, letterSpacing: -0.5 }}>
                {greeting}, {user.firstName}
              </Text>
              <Text style={{ marginTop: 6, color: colors.mutedStrong, fontWeight: '700', fontSize: 15 }}>Welcome back</Text>

              <View style={{ marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip compact style={{ backgroundColor: colors.surfaceMuted }} textStyle={{ fontWeight: '800', fontSize: 12 }}>
                  {!showLiveFirebaseUi || !isFirebaseConfigured()
                    ? 'Mock data'
                    : dataSourceIsLive
                      ? 'Live Firebase'
                      : 'Live device'}
                </Chip>
                {isFirebaseConfigured() ? (
                  <Chip compact style={{ backgroundColor: colors.surfaceMuted }} textStyle={{ fontWeight: '800', fontSize: 12 }}>
                    Firebase: {firebaseRtdbConnected ? 'connected' : 'disconnected'}
                  </Chip>
                ) : null}
                {dataSourceIsLive && liveWifi ? (
                  <>
                    <Chip compact style={{ backgroundColor: '#E0F2FE' }} textStyle={{ fontWeight: '800', fontSize: 12, color: colors.navy }}>
                      {liveWifi.firebaseRole ?? liveWifi.role.toUpperCase()}
                    </Chip>
                    <Chip compact style={{ backgroundColor: '#CFFAFE' }} textStyle={{ fontWeight: '800', fontSize: 12, color: colors.navy }}>
                      {liveWifi.role === 'gateway' ? 'Gateway Mode Active' : 'Single Device Mode'}
                    </Chip>
                  </>
                ) : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: colors.mutedStrong, fontWeight: '800', fontSize: 13 }}>Pond</Text>
              <Pressable
                onPress={() => setPondId((id) => (id === 'pond-a' ? 'pond-b' : 'pond-a'))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.soft,
                }}
              >
                <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 15 }}>{pond.name}</Text>
                <ChevronDown size={18} color={colors.mutedStrong} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <WaterQualityScoreCard
          score={pond.overallScore}
          statusLabel={scoreUi.label}
          statusTone={scoreUi.tone}
          summaryLine={scoreUi.summary}
          tips={['Keep turbidity under 25 NTU for best clarity.', 'Schedule calibration before seasonal swings.']}
        />
      </View>

      <SectionTitle title="Live metrics" />
      {waitingForTelemetry ? (
        <Card
          style={{
            marginBottom: spacing.md,
            borderRadius: radius.xl,
            ...shadows.soft,
            backgroundColor: '#FFFBEB',
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.45)',
          }}
        >
          <Card.Content>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Waiting for telemetry</Text>
            <Text style={{ marginTop: 6, color: colors.mutedStrong, lineHeight: 20 }}>
              Device is registered. Waiting for the first Firebase snapshot at devices/{liveReg?.deviceId}/latest or …/status…
            </Text>
          </Card.Content>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {s ? (
          <>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<Gauge size={20} color={colors.primary} />}
                title="pH"
                value={s.ph.toFixed(2)}
                statusLabel={phStatusLabel(s.ph)}
                statusTone={toneForPh(s.ph)}
                trendDelta={dataSourceIsLive ? undefined : 0.04}
              />
            </View>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<Droplets size={20} color={colors.primary} />}
                title="TDS"
                value={`${Math.round(s.tdsPpm)}`}
                unit="ppm"
                statusLabel={tdsStatusLabel(s.tdsPpm)}
                statusTone={toneForTds(s.tdsPpm)}
                trendDelta={dataSourceIsLive ? undefined : -6}
              />
            </View>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<ThermometerSun size={20} color={colors.primary} />}
                title="Temperature"
                value={s.temperatureC.toFixed(1)}
                unit="°C"
                statusLabel={tempStatusLabel(s.temperatureC)}
                statusTone={toneForTemp(s.temperatureC)}
                trendDelta={dataSourceIsLive ? undefined : 0.2}
              />
            </View>
            <View style={{ width: '47%' }}>
              <MetricCard
                icon={<Waves size={20} color={colors.primary} />}
                title="Turbidity"
                value={`${Math.round(s.turbidityNtu)}`}
                unit="NTU"
                statusLabel={turbidityStatusLabel(s.turbidityNtu)}
                statusTone={toneForTurb(s.turbidityNtu)}
                trendDelta={dataSourceIsLive ? undefined : 1.2}
              />
            </View>
            {dataSourceIsLive ? (
              <>
                <View style={{ width: '47%' }}>
                  <MetricCard
                    icon={<Battery size={20} color={colors.primary} />}
                    title="Battery"
                    value={`${Math.round(liveWifi?.batteryPercent ?? 0)}`}
                    unit="%"
                    statusLabel={liveWifi && liveWifi.batteryPercent > 20 ? 'OK' : 'Low'}
                    statusTone={liveWifi && liveWifi.batteryPercent > 20 ? 'success' : 'warning'}
                  />
                </View>
                <View style={{ width: '47%' }}>
                  <MetricCard
                    icon={<Wifi size={20} color={colors.primary} />}
                    title="Wi‑Fi RSSI"
                    value={`${Math.round(liveWifi?.wifiRssi ?? -100)}`}
                    unit="dBm"
                    statusLabel="Signal"
                    statusTone="info"
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </View>

      {dataSourceIsLive && liveWifi ? (
        <View style={{ marginTop: spacing.md }}>
          <LoRaStatusCard
            enabled={liveWifi.loraEnabled === true}
            initialized={liveWifi.loraInitialized === true}
            gatewayReady={liveWifi.loraGatewayReady === true}
            frequencyMhz={liveWifi.loraFrequencyMhz}
            packetCount={liveWifi.loraPacketCount}
            lastRssi={liveWifi.lastLoraRssi}
            lastSnr={liveWifi.lastLoraSnr}
            lastError={liveWifi.loraLastError}
            lastPayload={liveWifi.lastLoraPayload}
          />
        </View>
      ) : null}

      <SectionTitle title={dataSourceIsLive ? 'Device status' : 'Gateway status'} />
      {statusDevice ? (
        <DeviceStatusCard device={statusDevice} onPress={() => router.push(`/device/${statusDevice.id}`)} />
      ) : null}

      <SectionTitle title="Network summary" />
      <Card
        style={{
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Gateways</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.gateways}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Relays</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.relays}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Children</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.children}</Text>
          </View>
          {net.singles > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.mutedStrong, fontWeight: '800' }}>Single devices</Text>
              <Text style={{ color: colors.navy, fontWeight: '900' }}>{net.singles}</Text>
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>Active nodes</Text>
            <Text style={{ color: colors.primary, fontWeight: '900' }}>{net.active}</Text>
          </View>
        </Card.Content>
      </Card>

      <SectionTitle title="Latest alerts" actionLabel="See all" onActionPress={() => router.push('/(tabs)/alerts')} />
      <Card
        style={{
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content style={{ gap: spacing.md }}>
          {pondAlerts.length === 0 ? (
            <Text style={{ color: colors.mutedStrong, fontWeight: '600' }}>No active alerts. Great work.</Text>
          ) : (
            pondAlerts.map((a) => (
              <Pressable key={a.id} onPress={() => router.push({ pathname: '/alerts/alert-details', params: { id: a.id } })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 15 }}>{a.title}</Text>
                    <Text style={{ marginTop: 4, color: colors.mutedStrong, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                      {a.description}
                    </Text>
                    <Text style={{ marginTop: 6, color: colors.mutedStrong, fontSize: 12, fontWeight: '700' }}>
                      {formatRelativeTime(a.createdAt)}
                    </Text>
                  </View>
                  <StatusChip
                    label={a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info'}
                    tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}
                  />
                </View>
              </Pressable>
            ))
          )}
          <Chip
            icon="plus"
            mode="flat"
            onPress={() => router.push('/setup/add-device')}
            style={{ backgroundColor: colors.surfaceMuted, alignSelf: 'flex-start' }}
            textStyle={{ fontWeight: '800', color: colors.primary }}
          >
            Quick add: gateway or single device
          </Chip>
        </Card.Content>
      </Card>

      <SectionTitle title="pH trend" />
      <Text style={{ marginBottom: spacing.sm, color: colors.mutedStrong, fontSize: 13, fontWeight: '600' }}>
        {dataSourceIsLive ? 'Sample intraday curve (live history from firmware TODO).' : 'Demo trend data'}
      </Text>
      <Card
        style={{
          borderRadius: radius.xl,
          ...shadows.soft,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Card.Content>
          <SensorChart data={mockPhTrend()} height={170} />
        </Card.Content>
      </Card>

      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          right: spacing.md,
          bottom: fabBottom,
          backgroundColor: colors.primary,
        }}
        color="#fff"
        onPress={() => router.push('/setup/add-device')}
      />
    </AppScreen>
  );
}
