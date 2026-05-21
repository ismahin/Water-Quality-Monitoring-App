import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, RadioButton } from 'react-native-paper';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useMockApp } from '../../context/MockAppContext';
import type { AquaDevice } from '../../types/device';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';
import { NetworkRoleChip } from '../../components/NetworkRoleChip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { SetupStepCard } from '../../components/SetupStepCard';
import { SignalStrengthBar } from '../../components/SignalStrengthBar';

function parentLabel(device: AquaDevice): string {
  if (device.role === 'gateway') return `${device.name} Gateway`;
  if (device.role === 'relay') return `${device.name} Relay`;
  return `${device.name} Child`;
}

function rootGatewayFor(parent: AquaDevice): string {
  if (parent.role === 'gateway') return parent.id;
  return parent.rootGatewayId || parent.gatewayId || 'M1';
}

export default function AddChildNodeScreen() {
  const router = useRouter();
  const { devices } = useMockApp();
  const candidates = useMemo(() => {
    const live = devices.filter((d) => d.isLive && (d.role === 'gateway' || d.role === 'relay' || d.role === 'child'));
    const source = live.length ? live : devices.filter((d) => d.role === 'gateway' || d.role === 'relay' || d.role === 'child');
    return source;
  }, [devices]);
  const [parentId, setParentId] = useState(candidates[0]?.id ?? '');
  const parent = candidates.find((d) => d.id === parentId) ?? candidates[0];
  const rootGatewayId = parent ? rootGatewayFor(parent) : '';
  const networkId = parent?.networkId || 'POND_001';
  const parentMustConvert = parent?.role === 'child';

  return (
    <AppScreen>
      <AppHeader title="Add child node" onBack={() => router.back()} />

      <SetupStepCard
        step={1}
        totalSteps={4}
        title="Choose parent device"
        description="Pick the gateway, relay, or child that will receive this node. A child must be converted to relay before downstream nodes can use it."
      />

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
        <Card.Content style={{ gap: spacing.sm }}>
          {candidates.length === 0 ? (
            <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>No live gateway or network nodes are registered yet. Add and configure a gateway first.</Text>
          ) : (
            <RadioButton.Group onValueChange={setParentId} value={parent?.id ?? ''}>
              {candidates.map((item) => (
                <Pressable key={item.id} onPress={() => setParentId(item.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                  <RadioButton value={item.id} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '900', color: colors.navy }}>{parentLabel(item)}</Text>
                    <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <NetworkRoleChip role={item.universalRole ?? item.role.toUpperCase()} />
                      {item.networkId ? <NetworkRoleChip role={item.networkId} /> : null}
                    </View>
                  </View>
                </Pressable>
              ))}
            </RadioButton.Group>
          )}
        </Card.Content>
      </Card>

      {parent ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: colors.card }}>
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ fontWeight: '900', color: colors.navy }}>Selected parent</Text>
            <Text style={{ color: colors.mutedStrong }}>Parent ID: {parent.id}</Text>
            <Text style={{ color: colors.mutedStrong }}>Root gateway: {rootGatewayId}</Text>
            <Text style={{ color: colors.mutedStrong }}>Network: {networkId}</Text>
            {parent.role === 'gateway' && 'wifiRssi' in parent ? <SignalStrengthBar type="wifi" rssi={parent.wifiRssi} /> : null}
            {(parent.role === 'relay' || parent.role === 'child') && 'loraRssi' in parent ? (
              <SignalStrengthBar type="lora" rssi={parent.loraRssi} snr={parent.loraSnr} packetSuccess={parent.packetSuccessPercent} />
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {parentMustConvert ? (
        <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, ...shadows.soft, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' }}>
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>Parent must become a relay</Text>
            <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
              This device must become a relay before adding a child under it. Go near {parent?.id}, connect to its CFG_ BLE service, and enable relay mode.
            </Text>
            <PrimaryButton
              label="Convert Parent to Relay"
              onPress={() =>
                router.push({
                  pathname: '/setup/config-device',
                  params: {
                    deviceName: `CFG_${parent?.id}`,
                    deviceId: parent?.id,
                    targetRole: 'relay',
                    parentId: parent?.parentId ?? '',
                    rootGatewayId,
                    networkId,
                  },
                })
              }
            />
          </Card.Content>
        </Card>
      ) : null}

      <PrimaryButton
        label="Scan New Child Node (CFG_)"
        style={{ marginTop: spacing.lg }}
        disabled={!parent || parentMustConvert}
        onPress={() =>
          router.push({
            pathname: '/setup/scan-device',
            params: {
              mode: 'config',
              targetRole: 'child',
              parentId: parent?.id,
              rootGatewayId,
              networkId,
            },
          })
        }
      />
      <SecondaryButton
        label="Open LoRa Pairing Test"
        style={{ marginTop: spacing.sm }}
        disabled={!parent}
        onPress={() =>
          router.push({
            pathname: '/setup/lora-pairing',
            params: { parentId: parent?.id, gatewayId: rootGatewayId, networkId },
          })
        }
      />
    </AppScreen>
  );
}
