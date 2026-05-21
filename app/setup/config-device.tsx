import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActivityIndicator, Card, HelperText, Switch, TextInput } from 'react-native-paper';
import { Cpu, Radio, Router, Waypoints } from 'lucide-react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { AutoRoleCard } from '../../components/AutoRoleCard';
import { DeviceConfigCard } from '../../components/DeviceConfigCard';
import { NotificationSnackbar } from '../../components/NotificationSnackbar';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import {
  connectConfigDevice,
  disconnectConfigDevice,
  getConfig,
  getStatus,
  parseDeviceIdFromConfigName,
  setUniversalConfig,
  type BleConfigError,
} from '../../services/ble/bleConfigService';
import type { UniversalDeviceConfig, UniversalRole } from '../../types/universalDevice';

function roleForConfig(config: UniversalDeviceConfig, statusRole?: string): UniversalRole {
  if (statusRole === 'SINGLE' || statusRole === 'GATEWAY' || statusRole === 'RELAY' || statusRole === 'CHILD') return statusRole;
  if (config.gatewayUplinkEnabled) return 'GATEWAY';
  if (config.relayEnabled) return 'RELAY';
  if (config.parentId) return 'CHILD';
  return 'SINGLE';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function configFromUnknown(value: unknown, fallback: UniversalDeviceConfig): UniversalDeviceConfig {
  const raw = asRecord(value);
  const config = asRecord(raw.config ?? raw.raw ?? raw);
  return {
    deviceId: String(config.deviceId ?? config.device_id ?? fallback.deviceId),
    networkId: String(config.networkId ?? config.network_id ?? fallback.networkId),
    parentId: String(config.parentId ?? config.parent_id ?? fallback.parentId),
    rootGatewayId: String(config.rootGatewayId ?? config.root_gateway_id ?? fallback.rootGatewayId),
    gatewayUplinkEnabled: Boolean(config.gatewayUplinkEnabled ?? config.gateway_uplink_enabled ?? fallback.gatewayUplinkEnabled),
    relayEnabled: Boolean(config.relayEnabled ?? config.relay_enabled ?? fallback.relayEnabled),
    sampleIntervalMs: Number(config.sampleIntervalMs ?? config.sample_interval_ms ?? fallback.sampleIntervalMs) || 10000,
  };
}

function statusRole(value: unknown): string | undefined {
  const raw = asRecord(value);
  const status = asRecord(raw.raw ?? raw);
  const role = status.role;
  return typeof role === 'string' ? role.toUpperCase() : undefined;
}

const roleCards = [
  {
    role: 'GATEWAY',
    title: 'Gateway',
    body: 'Wi-Fi uplink enabled, relay off, parent empty, root is this device.',
    icon: Router,
  },
  {
    role: 'RELAY',
    title: 'Relay',
    body: 'LoRa forwarding enabled under a selected parent and root gateway.',
    icon: Waypoints,
  },
  {
    role: 'CHILD',
    title: 'Child',
    body: 'LoRa sensor node under a parent. No Wi-Fi uplink.',
    icon: Cpu,
  },
  {
    role: 'SINGLE',
    title: 'Single',
    body: 'Standalone Wi-Fi device. The physical toggle must be in SINGLE mode.',
    icon: Radio,
  },
] as const;

export default function ConfigDeviceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    deviceName?: string;
    deviceId?: string;
    targetRole?: string;
    parentId?: string;
    rootGatewayId?: string;
    networkId?: string;
  }>();
  const { addRegisteredDevice } = useMockApp();
  const deviceName = String(params.deviceName ?? (params.deviceId ? `CFG_${params.deviceId}` : 'CFG_M1'));
  const parsedId = parseDeviceIdFromConfigName(deviceName);
  const initialConfig = useMemo<UniversalDeviceConfig>(
    () => {
      const target = String(params.targetRole ?? '').toUpperCase();
      const id = String(params.deviceId ?? parsedId);
      return {
        deviceId: id,
        networkId: String(params.networkId ?? 'POND_001'),
        parentId: target === 'GATEWAY' || target === 'SINGLE' ? '' : String(params.parentId ?? ''),
        rootGatewayId: String(params.rootGatewayId ?? (target === 'GATEWAY' || target === 'SINGLE' ? id : '')),
        gatewayUplinkEnabled: target === 'GATEWAY',
        relayEnabled: target === 'RELAY',
        sampleIntervalMs: 10000,
      };
    },
    [params.deviceId, params.networkId, params.parentId, params.rootGatewayId, params.targetRole, parsedId],
  );

  const [phase, setPhase] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<UniversalDeviceConfig>(initialConfig);
  const [statusJson, setStatusJson] = useState<unknown>(null);
  const [responseJson, setResponseJson] = useState<unknown>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const currentRole = roleForConfig(config, statusRole(statusJson));

  const connectAndLoad = useCallback(async () => {
    setPhase('connecting');
    setBusy(true);
    try {
      await connectConfigDevice(deviceName);
      const [cfg, status] = await Promise.all([getConfig(), getStatus()]);
      setConfig((prev) => configFromUnknown(cfg, prev));
      setStatusJson(status);
      setResponseJson({ config: cfg, status });
      setPhase('ready');
    } catch (e) {
      const err = e as BleConfigError;
      setSnack(err.message ?? 'Could not connect to CFG device.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }, [deviceName]);

  useEffect(() => {
    void connectAndLoad();
    return () => {
      void disconnectConfigDevice();
    };
  }, [connectAndLoad]);

  const applyRole = useCallback((role: UniversalRole) => {
    setConfig((prev) => {
      if (role === 'GATEWAY') {
        return { ...prev, parentId: '', rootGatewayId: prev.deviceId, gatewayUplinkEnabled: true, relayEnabled: false };
      }
      if (role === 'RELAY') {
        return { ...prev, gatewayUplinkEnabled: false, relayEnabled: true, parentId: prev.parentId || params.parentId || '', rootGatewayId: prev.rootGatewayId || params.rootGatewayId || '' };
      }
      if (role === 'CHILD') {
        return { ...prev, gatewayUplinkEnabled: false, relayEnabled: false, parentId: prev.parentId || params.parentId || '', rootGatewayId: prev.rootGatewayId || params.rootGatewayId || '' };
      }
      return { ...prev, parentId: '', rootGatewayId: prev.deviceId, gatewayUplinkEnabled: false, relayEnabled: false };
    });
  }, [params.parentId, params.rootGatewayId]);

  const saveConfig = useCallback(async (navigateAfter = true) => {
    setBusy(true);
    try {
      const normalized: UniversalDeviceConfig = {
        ...config,
        deviceId: config.deviceId.trim(),
        networkId: config.networkId.trim(),
        parentId: config.parentId.trim(),
        rootGatewayId: config.rootGatewayId.trim() || config.deviceId.trim(),
        sampleIntervalMs: Number(config.sampleIntervalMs) || 10000,
      };
      const response = await setUniversalConfig(normalized);
      setResponseJson(response);
      setConfig(normalized);
      await addRegisteredDevice(normalized.deviceId, {
        name: normalized.deviceId,
        networkId: normalized.networkId,
        roleHint: roleForConfig(normalized, statusRole(statusJson)),
        parentId: normalized.parentId,
        rootGatewayId: normalized.rootGatewayId,
        bleConfigName: deviceName,
      });
      setSnack('Config saved.');
      if (navigateAfter) router.replace(`/device/${normalized.deviceId}`);
    } catch (e) {
      const err = e as BleConfigError;
      setSnack(err.message ?? 'Could not save config.');
    } finally {
      setBusy(false);
    }
  }, [addRegisteredDevice, config, deviceName, router, statusJson]);

  const saveAndRestart = useCallback(async () => {
    await saveConfig(false);
    setSnack('Config saved. Restart command is not defined in firmware yet; power-cycle the device if needed.');
  }, [saveConfig]);

  const testLora = useCallback(async () => {
    setBusy(true);
    try {
      const status = await getStatus();
      setStatusJson(status);
      setResponseJson(status);
      setSnack('Status refreshed. START_SIGNAL_TEST is pending firmware support.');
    } catch (e) {
      const err = e as BleConfigError;
      setSnack(err.message ?? 'Could not refresh status.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <AppScreen>
      <AppHeader title="Configure Device" subtitle={deviceName} onBack={() => router.back()} />

      <SetupStepCard
        step={2}
        totalSteps={3}
        title={phase === 'ready' ? 'Connected to CFG device' : phase === 'connecting' ? 'Connecting to CFG device' : 'CFG connection issue'}
        description="Read current firmware status, choose the universal role, then save SET_CONFIG over BLE."
      />

      {phase === 'connecting' ? (
        <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator />
          <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>Connecting...</Text>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        <AutoRoleCard
          role={currentRole}
          hardwareMode={String(asRecord(asRecord(statusJson).raw ?? statusJson).hardware_mode ?? '')}
          gatewayUplinkEnabled={config.gatewayUplinkEnabled}
          relayEnabled={config.relayEnabled}
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <DeviceConfigCard config={config} />
      </View>

      <Text style={{ marginTop: spacing.lg, fontWeight: '900', color: colors.navy, fontSize: 16 }}>Role helpers</Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {roleCards.map((item) => {
          const Icon = item.icon;
          const active = currentRole === item.role;
          return (
            <Pressable key={item.role} onPress={() => applyRole(item.role)}>
              <Card
                style={{
                  borderRadius: radius.lg,
                  ...shadows.soft,
                  backgroundColor: active ? '#E0F2FE' : colors.card,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Icon size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.navy, fontWeight: '900' }}>{item.title}</Text>
                    <Text style={{ color: colors.mutedStrong, marginTop: 4, lineHeight: 18 }}>{item.body}</Text>
                  </View>
                </Card.Content>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ marginTop: spacing.lg, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 16 }}>Config form</Text>
          <TextInput mode="outlined" label="Device ID" value={config.deviceId} onChangeText={(v) => setConfig((p) => ({ ...p, deviceId: v }))} autoCapitalize="none" />
          <TextInput mode="outlined" label="Network ID" value={config.networkId} onChangeText={(v) => setConfig((p) => ({ ...p, networkId: v }))} autoCapitalize="none" />
          <TextInput mode="outlined" label="Parent ID" value={config.parentId} onChangeText={(v) => setConfig((p) => ({ ...p, parentId: v }))} autoCapitalize="none" />
          <TextInput mode="outlined" label="Root Gateway ID" value={config.rootGatewayId} onChangeText={(v) => setConfig((p) => ({ ...p, rootGatewayId: v }))} autoCapitalize="none" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.navy, fontWeight: '800' }}>Gateway uplink enabled</Text>
            <Switch value={config.gatewayUplinkEnabled} onValueChange={(v) => setConfig((p) => ({ ...p, gatewayUplinkEnabled: v, relayEnabled: v ? false : p.relayEnabled }))} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.navy, fontWeight: '800' }}>Relay enabled</Text>
            <Switch value={config.relayEnabled} onValueChange={(v) => setConfig((p) => ({ ...p, relayEnabled: v, gatewayUplinkEnabled: v ? false : p.gatewayUplinkEnabled }))} />
          </View>
          <TextInput
            mode="outlined"
            label="Sample interval (ms)"
            value={String(config.sampleIntervalMs)}
            onChangeText={(v) => setConfig((p) => ({ ...p, sampleIntervalMs: Number(v.replace(/[^0-9]/g, '')) || 0 }))}
            keyboardType="number-pad"
          />
          <HelperText type="info">SET_CONFIG is the only save command sent. Restart and signal-test commands are shown as future firmware hooks.</HelperText>
        </Card.Content>
      </Card>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <PrimaryButton label={busy ? 'Saving...' : 'Save Config'} onPress={() => void saveConfig(true)} disabled={busy || !config.deviceId.trim()} />
        <SecondaryButton label="Save and Restart" onPress={() => void saveAndRestart()} disabled={busy || !config.deviceId.trim()} />
        <SecondaryButton label="Test LoRa / Initialize LoRa" onPress={() => void testLora()} disabled={busy} />
        <SecondaryButton label={debugVisible ? 'Hide BLE response JSON' : 'Show BLE response JSON'} onPress={() => setDebugVisible((v) => !v)} />
      </View>

      {debugVisible ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.lg, ...shadows.soft, backgroundColor: colors.surfaceMuted }}>
          <Card.Content>
            <ScrollView horizontal>
              <Text selectable style={{ color: colors.navy, fontFamily: 'monospace', fontSize: 12 }}>
                {JSON.stringify(responseJson ?? statusJson ?? {}, null, 2)}
              </Text>
            </ScrollView>
          </Card.Content>
        </Card>
      ) : null}

      <NotificationSnackbar visible={!!snack} onDismiss={() => setSnack(null)} message={snack ?? ''} duration={5000} />
    </AppScreen>
  );
}
