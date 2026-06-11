import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Chip, ProgressBar } from 'react-native-paper';
import { onValue, ref } from 'firebase/database';
import { Bluetooth, CheckCircle2, Route, ShieldAlert } from 'lucide-react-native';
import { AppHeader } from '../../components/AppHeader';
import { AppScreen } from '../../components/AppScreen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryButton } from '../../components/SecondaryButton';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { useDeviceLatest } from '../../hooks/useDeviceLatest';
import { usePairingBle } from '../../hooks/usePairingBle';
import { getFirebaseDb } from '../../services/firebase/firebaseClient';
import { legacyGatewayChildrenPath, networkGatewayChildLatestPath, networkGatewayChildStatusPath } from '../../services/firebase/schemaV4Paths';
import type { PairingBleDevice, PairingDeviceRole, PairingNotification, PairingParent } from '../../types/pairing';
import { DEFAULT_NETWORK_ID } from '../../utils/pairingUtils';

type ExtendStep = 'instructions' | 'ble' | 'validate' | 'parents' | 'progress' | 'success';

function getParentDisplayRole(parent: PairingParent): string {
  if (parent.role === 'GATEWAY') return 'Gateway';
  if (parent.role === 'RELAY') return 'Relay';
  if (parent.role === 'RELAY_CANDIDATE') return 'Can become relay';
  if (parent.role === 'CHILD') return 'Child';
  return parent.role;
}

function getParentExplanation(parent: PairingParent): string {
  if (parent.role === 'GATEWAY') return 'Direct gateway parent.';
  if (parent.role === 'RELAY') return 'Already working as a relay. New child data will pass through this device.';
  if (parent.role === 'RELAY_CANDIDATE') return 'Currently a child. It will automatically become a relay when selected.';
  return 'Available LoRa parent.';
}

function buildRoutePreview(newDeviceId: string, parent: PairingParent): string {
  const childId = newDeviceId || 'New Child';
  if (parent.role === 'GATEWAY') return `${childId} -> ${parent.id} Gateway`;
  if (parent.role === 'RELAY') return `${childId} -> ${parent.id} Relay -> ${parent.root_gateway_id} Gateway`;
  if (parent.role === 'RELAY_CANDIDATE') return `${childId} -> ${parent.id} Auto Relay -> ${parent.root_gateway_id} Gateway`;
  return `${childId} -> ${parent.id} -> ${parent.root_gateway_id || 'Gateway'}`;
}

function getSignalLabel(rssi?: number): 'Excellent' | 'Good' | 'Fair' | 'Weak' | 'Unknown' {
  if (typeof rssi !== 'number') return 'Unknown';
  if (rssi >= -55) return 'Excellent';
  if (rssi >= -67) return 'Good';
  if (rssi >= -75) return 'Fair';
  return 'Weak';
}

function signalTone(rssi?: number): string {
  const label = getSignalLabel(rssi);
  if (label === 'Excellent' || label === 'Good') return colors.success;
  if (label === 'Fair') return colors.warning;
  if (label === 'Weak') return colors.danger;
  return colors.mutedStrong;
}

function sortParents(parents: PairingParent[], networkId: string): PairingParent[] {
  return [...parents].sort((a, b) => {
    const networkScore = Number(b.network_id === networkId) - Number(a.network_id === networkId);
    if (networkScore !== 0) return networkScore;
    const rssiScore = (b.rssi ?? -120) - (a.rssi ?? -120);
    if (rssiScore !== 0) return rssiScore;
    const depthScore = (a.depth ?? 999) - (b.depth ?? 999);
    if (depthScore !== 0) return depthScore;
    return (a.child_count ?? 999) - (b.child_count ?? 999);
  });
}

function notificationKey(notification: PairingNotification | undefined): string {
  return notification ? JSON.stringify(notification) : '';
}

function isSuccessfulPairAck(notification: PairingNotification | undefined): boolean {
  if (!notification) return false;
  if (notification.type === 'pair_result') return notification.ok === true;
  if (notification.type === 'server_test') return notification.status === 'sent' || notification.ok === true;
  if (notification.type !== 'cmd_ack') return false;
  const stage = typeof notification.stage === 'string' ? notification.stage : '';
  return notification.ok === true && ['PAIR_SAVED_WAITING_TEST', 'ACTIVE', 'saved', 'server_test'].includes(stage);
}

function roleBadgeColor(role: PairingDeviceRole): string {
  if (role === 'GATEWAY') return '#E0F2FE';
  if (role === 'RELAY') return '#CCFBF1';
  if (role === 'RELAY_CANDIDATE') return '#FEF3C7';
  return colors.surfaceMuted;
}

function DeviceRow({
  device,
  connecting,
  onConnect,
}: {
  device: PairingBleDevice;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <Card style={{ borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.soft }}>
      <Card.Content style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
            <Bluetooth size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.navy, fontWeight: '900' }}>{device.name}</Text>
            <Text style={{ color: colors.mutedStrong, fontWeight: '700' }}>{device.deviceId} - {device.rssi} dBm - {getSignalLabel(device.rssi)}</Text>
          </View>
          <PrimaryButton label="Connect" loading={connecting} disabled={connecting} onPress={onConnect} />
        </View>
      </Card.Content>
    </Card>
  );
}

function ParentCard({
  parent,
  selected,
  newDeviceId,
  onPress,
}: {
  parent: PairingParent;
  selected: boolean;
  newDeviceId: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card
        style={{
          borderRadius: radius.lg,
          backgroundColor: selected ? '#ECFDF5' : colors.card,
          borderWidth: 1,
          borderColor: selected ? colors.success : colors.border,
          ...shadows.soft,
        }}
      >
        <Card.Content style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.navy, fontSize: 17, fontWeight: '900' }}>{parent.id}</Text>
              <Text style={{ color: colors.mutedStrong, marginTop: 4 }}>{buildRoutePreview(newDeviceId, parent)}</Text>
            </View>
            <Chip compact style={{ backgroundColor: roleBadgeColor(parent.role) }} textStyle={{ fontWeight: '900', fontSize: 11 }}>
              {getParentDisplayRole(parent)}
            </Chip>
          </View>
          <Text style={{ color: colors.mutedStrong }}>{getParentExplanation(parent)}</Text>
          {parent.role === 'RELAY_CANDIDATE' ? (
            <Text style={{ color: colors.warning, fontWeight: '800' }}>
              This device is currently a child. Because its pairing switch is ON, firmware will automatically promote it to relay after pairing.
            </Text>
          ) : null}
          <Text style={{ color: signalTone(parent.rssi), fontWeight: '900' }}>
            {getSignalLabel(parent.rssi)} - RSSI {parent.rssi ?? '-'} dBm{typeof parent.snr === 'number' ? ` - SNR ${parent.snr}` : ''}
          </Text>
          <Text style={{ color: colors.mutedStrong }}>
            Network {parent.network_id} - Root {parent.root_gateway_id || '-'} - Depth {parent.depth ?? '-'} - Children {parent.child_count ?? '-'}/{parent.max_children ?? '-'}
          </Text>
        </Card.Content>
      </Card>
    </Pressable>
  );
}

function ProgressRow({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {done ? <CheckCircle2 size={20} color={colors.success} /> : <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border }} />}
      <Text style={{ color: colors.navy, fontWeight: '800', flex: 1 }}>{label}</Text>
    </View>
  );
}

export default function PairingWizardScreen() {
  const router = useRouter();
  const { networkId: networkParam } = useLocalSearchParams<{ networkId?: string }>();
  const ble = usePairingBle();
  const [step, setStep] = useState<ExtendStep>('instructions');
  const [selectedParent, setSelectedParent] = useState<PairingParent | null>(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pairStarted, setPairStarted] = useState(false);
  const [parentAccepted, setParentAccepted] = useState(false);
  const [pairSaved, setPairSaved] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSending, setPairSending] = useState(false);
  const [pairCommandSent, setPairCommandSent] = useState(false);
  const [childFirebaseSeen, setChildFirebaseSeen] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [serverTestTimedOut, setServerTestTimedOut] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [handledPairStartedKey, setHandledPairStartedKey] = useState('');
  const [handledPairResultKey, setHandledPairResultKey] = useState('');
  const [handledServerTestKey, setHandledServerTestKey] = useState('');
  const [handledCmdAckKey, setHandledCmdAckKey] = useState('');

  const newDeviceId = ble.info?.deviceId ?? ble.connectedDevice?.name?.replace(/^WQMPAIR_/, '') ?? 'New Device';
  const networkId = ble.info?.networkId || networkParam || DEFAULT_NETWORK_ID;
  const deviceLive = useDeviceLatest(networkId, newDeviceId || '-');
  const cloudConfirmed = !!deviceLive.latest || !!deviceLive.status || childFirebaseSeen;
  const sortedParents = useMemo(
    () => sortParents(ble.parents.filter((parent) => parent.id !== newDeviceId), networkId),
    [ble.parents, networkId, newDeviceId],
  );
  const latestPairStarted = ble.notifications.find((notification) => notification.type === 'pair_started');
  const latestParentsNotification = ble.notifications.find((notification) => notification.type === 'parents');
  const latestPairResult = ble.notifications.find((notification) => notification.type === 'pair_result');
  const latestServerTest = ble.notifications.find((notification) => notification.type === 'server_test');
  const latestCmdAck = ble.notifications.find((notification) => notification.type === 'cmd_ack');
  const validationError =
    ble.info?.switchMode === 'NORMAL'
      ? 'Turn the device pairing switch ON, then press Retry.'
      : ble.info && !ble.info.loraReady
        ? 'LoRa is not ready on this device. Check antenna/module wiring and restart.'
        : null;
  const bleDisconnectedDuringSetup = step !== 'instructions' && step !== 'ble' && !ble.connectedDevice;
  const alreadyPaired = ble.info?.paired === true;
  const canScanParents =
    !!ble.connectedDevice &&
    (!ble.info ||
      (ble.info.switchMode === 'PAIRING' &&
        ble.info.loraReady === true &&
        ble.info.paired !== true));
  const progressValue =
    cloudConfirmed ? 1 : testId || serverTestTimedOut ? 0.9 : pairSaved ? 0.78 : parentAccepted ? 0.66 : pairStarted ? 0.55 : selectedParent ? 0.42 : scanComplete ? 0.3 : ble.info ? 0.2 : ble.connectedDevice ? 0.1 : 0.04;

  useEffect(() => {
    if (!latestPairStarted || latestPairStarted.type !== 'pair_started') return;
    const key = notificationKey(latestPairStarted);
    if (key === handledPairStartedKey) return;
    setHandledPairStartedKey(key);
    if (latestPairStarted.ok === true) {
      setPairStarted(true);
      setParentAccepted(true);
      setPairError(null);
    } else {
      setPairError(latestPairStarted.message ?? 'Pair request was rejected.');
    }
  }, [handledPairStartedKey, latestPairStarted]);

  useEffect(() => {
    if (latestParentsNotification?.type === 'parents') setScanComplete(true);
  }, [latestParentsNotification]);

  useEffect(() => {
    if (step !== 'parents' || scanComplete) return;
    const timer = setTimeout(() => setScanComplete(true), 10000);
    return () => clearTimeout(timer);
  }, [scanComplete, step]);

  useEffect(() => {
    if (!latestPairResult || latestPairResult.type !== 'pair_result') return;
    const key = notificationKey(latestPairResult);
    if (key === handledPairResultKey) return;
    setHandledPairResultKey(key);
    if (latestPairResult.ok === true) {
      setPairSaved(true);
      setPairError(null);
    } else {
      setPairError(latestPairResult.message ?? `Pairing failed at ${latestPairResult.stage ?? 'unknown stage'}.`);
    }
  }, [handledPairResultKey, latestPairResult]);

  useEffect(() => {
    if (!latestServerTest || latestServerTest.type !== 'server_test') return;
    const key = notificationKey(latestServerTest);
    if (key === handledServerTestKey) return;
    setHandledServerTestKey(key);
    setServerTestTimedOut(false);
    if (typeof latestServerTest.test_id === 'string') setTestId(latestServerTest.test_id);
  }, [handledServerTestKey, latestServerTest]);

  useEffect(() => {
    if (!latestCmdAck || latestCmdAck.type !== 'cmd_ack') return;
    const key = notificationKey(latestCmdAck);
    if (key === handledCmdAckKey) return;
    setHandledCmdAckKey(key);
    if (latestCmdAck.ok !== true) {
      setPairError(latestCmdAck.message ?? `Command failed at ${latestCmdAck.stage ?? 'unknown stage'}.`);
      return;
    }
    if (latestCmdAck.stage === 'PAIR_ACCEPTED_WAITING_ACK') {
      setPairStarted(true);
      setParentAccepted(true);
    }
    if (isSuccessfulPairAck(latestCmdAck)) {
      setPairStarted(true);
      setParentAccepted(true);
      setPairSaved(true);
      setPairError(null);
      setServerTestTimedOut(true);
    }
  }, [handledCmdAckKey, latestCmdAck]);

  useEffect(() => {
    if (pairSaved && (testId || serverTestTimedOut)) setStep('success');
  }, [pairSaved, serverTestTimedOut, testId]);

  useEffect(() => {
    setChildFirebaseSeen(false);
    if (!selectedParent || !newDeviceId || newDeviceId === 'New Device') return;
    const db = getFirebaseDb();
    if (!db) return;

    const gatewayId = selectedParent.root_gateway_id || selectedParent.id;
    const childId = newDeviceId;
    const paths = [
      networkGatewayChildStatusPath(networkId, gatewayId, childId),
      networkGatewayChildLatestPath(networkId, gatewayId, childId),
      `${legacyGatewayChildrenPath(gatewayId)}/${childId}/status`,
      `${legacyGatewayChildrenPath(gatewayId)}/${childId}/latest`,
    ];

    const unsubs = paths.map((path) =>
      onValue(ref(db, path), (snapshot) => {
        if (!snapshot.exists()) return;
        console.log('[PAIRING UI] Firebase child confirmation found at:', path);
        setChildFirebaseSeen(true);
      }),
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [networkId, newDeviceId, selectedParent]);

  useEffect(() => {
    if (!pairCommandSent || !cloudConfirmed) return;
    setPairSaved(true);
    setPairError(null);
    setServerTestTimedOut(true);
    setStep('success');
  }, [cloudConfirmed, pairCommandSent]);

  useEffect(() => {
    if (!pairSaved || testId) return;
    const timer = setTimeout(() => setServerTestTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, [pairSaved, testId]);

  const startBleScan = async () => {
    setStep('ble');
    try {
      await ble.startScan();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not start BLE scan.');
    }
  };

  const connectNewDevice = async (deviceId: string) => {
    try {
      await ble.connect(deviceId);
      setStep('validate');
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not connect to the new device.');
    }
  };

  const scanParents = async () => {
    setScanError(null);
    setScanComplete(ble.parents.length > 0);
    setSelectedParent(null);
    setStep('parents');
    console.log('[LORA UI] Sending LoRa parent scan command: {"cmd":"scan"}');
    try {
      await ble.actions.scanParents();
    } catch (error) {
      if (ble.parents.length === 0) {
        setScanError(error instanceof Error ? error.message : 'Could not send LoRa parent scan command.');
        setScanComplete(true);
      } else {
        console.warn('[LORA UI] Parent scan command failed, using already received parent beacons:', error);
      }
    }
  };

  const selectParent = (parent: PairingParent) => {
    setSelectedParent(parent);
  };

  const pairNewChild = async () => {
    if (!selectedParent || pairSending) return;
    setStep('progress');
    setPairSending(true);
    setPairStarted(false);
    setParentAccepted(false);
    setPairSaved(false);
    setPairError(null);
    setPairCommandSent(false);
    setChildFirebaseSeen(false);
    setTestId(null);
    setServerTestTimedOut(false);
    console.log('[LORA UI] Sending pair command:', JSON.stringify({ cmd: 'pair', parent_id: selectedParent.id, role: 'CHILD', network_id: selectedParent.network_id }));
    try {
      await ble.actions.startPairing(selectedParent.id, 'CHILD', selectedParent.network_id);
      setPairCommandSent(true);
      setPairStarted(true);
    } catch (error) {
      setPairError(error instanceof Error ? error.message : 'Could not send pair command.');
    } finally {
      setPairSending(false);
    }
  };

  const resetPairing = async () => {
    setPairError(null);
    try {
      await ble.actions.resetPairing();
      setTimeout(() => void ble.actions.getInfo().catch((error) => {
        console.warn('[BLE INFO] Refresh after reset failed:', error);
      }), 500);
    } catch (error) {
      setPairError(error instanceof Error ? error.message : 'Could not reset pairing.');
    }
  };

  const addAnother = async () => {
    setSelectedParent(null);
    setScanComplete(false);
    setPairStarted(false);
    setParentAccepted(false);
    setPairSaved(false);
    setPairError(null);
    setPairSending(false);
    setPairCommandSent(false);
    setChildFirebaseSeen(false);
    setTestId(null);
    setServerTestTimedOut(false);
    await ble.disconnect();
    setStep('instructions');
  };

  return (
    <AppScreen>
      <AppHeader
        title="Add Child / Extend Network"
        subtitle="AutoRelay + SmartRouting setup"
        onBack={() => {
          void ble.disconnect();
          router.back();
        }}
      />

      {ble.error || scanError || pairError ? (
        <Card style={{ borderRadius: radius.lg, backgroundColor: '#FEF2F2', marginBottom: spacing.md }}>
          <Card.Content>
            <Text selectable style={{ color: colors.danger, fontWeight: '800' }}>{ble.error ?? scanError ?? pairError}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {bleDisconnectedDuringSetup ? (
        <Card style={{ borderRadius: radius.lg, backgroundColor: '#FEF2F2', marginBottom: spacing.md }}>
          <Card.Content style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.danger, fontWeight: '900' }}>BLE disconnected from the new device.</Text>
            <Text style={{ color: colors.mutedStrong }}>Reconnect the new device, then scan parents again.</Text>
            <PrimaryButton label="Reconnect / Scan BLE" onPress={() => void startBleScan()} />
          </Card.Content>
        </Card>
      ) : null}

      {step === 'instructions' ? (
        <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 19 }}>To add a child device</Text>
            {[
              'Turn PAIRING mode ON on the new device.',
              'Turn PAIRING mode ON on the parent device.',
              'The parent can be a gateway, relay, or existing child.',
              'If the parent is currently a child, it will automatically become a relay after pairing.',
            ].map((item, index) => (
              <Text key={item} style={{ color: colors.mutedStrong, fontWeight: '700', lineHeight: 21 }}>{index + 1}. {item}</Text>
            ))}
            <Card style={{ borderRadius: radius.lg, backgroundColor: '#FFFBEB' }}>
              <Card.Content style={{ flexDirection: 'row', gap: spacing.sm }}>
                <ShieldAlert size={22} color={colors.warning} />
                <Text style={{ color: colors.warning, fontWeight: '900', flex: 1 }}>
                  Do not connect to the old parent device. The parent is discovered by LoRa.
                </Text>
              </Card.Content>
            </Card>
            <PrimaryButton label="Start BLE Scan" loading={ble.scanning} onPress={() => void startBleScan()} />
          </Card.Content>
        </Card>
      ) : null}

      {step === 'ble' ? (
        <View style={{ gap: spacing.md }}>
          <PrimaryButton label={ble.scanning ? 'Scanning...' : 'Rescan BLE devices'} loading={ble.scanning} onPress={() => void ble.startScan()} />
          <Text selectable style={{ color: colors.mutedStrong, lineHeight: 20 }}>{ble.scanSummary}</Text>
          {ble.devices.length === 0 && !ble.scanning ? (
            <Text style={{ color: colors.mutedStrong }}>No new WQMPAIR device found. Turn PAIRING mode ON on the new device and rescan.</Text>
          ) : null}
          {ble.devices.map((device) => (
            <DeviceRow key={device.id} device={device} connecting={ble.connecting} onConnect={() => void connectNewDevice(device.id)} />
          ))}
        </View>
      ) : null}

      {step === 'validate' ? (
        <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>New device validation</Text>
            {!ble.info ? <Text style={{ color: colors.mutedStrong }}>Loading device info...</Text> : null}
            {ble.info ? (
              <>
                <Text selectable style={{ color: colors.mutedStrong }}>Device ID: {ble.info.deviceId}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Network ID: {ble.info.networkId}</Text>
                <Text style={{ color: colors.mutedStrong }}>Role: {ble.info.role}</Text>
                <Text style={{ color: colors.mutedStrong }}>Switch mode: {ble.info.switchMode}</Text>
                <Text style={{ color: colors.mutedStrong }}>LoRa ready: {ble.info.loraReady ? 'Yes' : 'No'}</Text>
                <Text style={{ color: colors.mutedStrong }}>Already paired: {ble.info.paired ? 'Yes' : 'No'}</Text>
              </>
            ) : null}
            {validationError ? (
              <Card style={{ borderRadius: radius.lg, backgroundColor: '#FFFBEB' }}>
                <Card.Content style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.warning, fontWeight: '900' }}>{validationError}</Text>
                  <SecondaryButton label="Retry" onPress={() => void ble.actions.getInfo()} />
                </Card.Content>
              </Card>
            ) : null}
            {alreadyPaired ? (
              <Card style={{ borderRadius: radius.lg, backgroundColor: '#FFFBEB' }}>
                <Card.Content style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.warning, fontWeight: '900' }}>
                    This device is already paired. To add it as a new child, reset LoRa pairing first.
                  </Text>
                  <SecondaryButton label="Reset Pairing" onPress={() => void resetPairing()} />
                  <SecondaryButton label="Continue anyway" disabled={!!validationError} onPress={() => void scanParents()} />
                </Card.Content>
              </Card>
            ) : null}
            {!alreadyPaired ? (
              <PrimaryButton label="Scan LoRa Parents" disabled={!canScanParents} onPress={() => void scanParents()} />
            ) : null}
            <SecondaryButton label="Back" onPress={() => setStep('ble')} />
          </Card.Content>
        </Card>
      ) : null}

      {step === 'parents' ? (
        <View style={{ gap: spacing.md }}>
          <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
            <Card.Content style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>LoRa parents</Text>
                <SecondaryButton label="Rescan Parents" onPress={() => void scanParents()} />
              </View>
              <Text style={{ color: colors.mutedStrong }}>
                Parent scan uses LoRa command {'{"cmd":"scan"}'} from the connected new device.
              </Text>
              {scanComplete && sortedParents.length === 0 ? (
                <Text style={{ color: colors.warning, fontWeight: '900' }}>
                  No parent found. Turn pairing mode ON on your gateway, relay, or existing child, then press Rescan.
                </Text>
              ) : null}
            </Card.Content>
          </Card>
          {sortedParents.map((parent) => (
            <ParentCard
              key={parent.id}
              parent={parent}
              selected={selectedParent?.id === parent.id}
              newDeviceId={newDeviceId}
              onPress={() => selectParent(parent)}
            />
          ))}
          {selectedParent ? (
            <Card style={{ borderRadius: radius.xl, backgroundColor: '#F8FAFC', ...shadows.soft }}>
              <Card.Content style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Route preview</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Route size={22} color={colors.primary} />
                  <Text selectable style={{ color: colors.navy, fontWeight: '900', flex: 1 }}>{buildRoutePreview(newDeviceId, selectedParent)}</Text>
                </View>
                <Text selectable style={{ color: colors.mutedStrong }}>Parent ID: {selectedParent.id}</Text>
                <Text style={{ color: colors.mutedStrong }}>Parent role: {getParentDisplayRole(selectedParent)}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Root gateway ID: {selectedParent.root_gateway_id}</Text>
                <Text style={{ color: colors.mutedStrong }}>Depth: {selectedParent.depth} - RSSI: {selectedParent.rssi ?? '-'} - SNR: {selectedParent.snr ?? '-'}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Network ID: {selectedParent.network_id}</Text>
                <PrimaryButton label={pairSending ? 'Pairing...' : 'Pair New Child'} loading={pairSending} disabled={pairSending} onPress={() => void pairNewChild()} />
              </Card.Content>
            </Card>
          ) : null}
        </View>
      ) : null}

      {step === 'progress' ? (
        <Card style={{ borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>Pairing progress</Text>
            <ProgressBar progress={progressValue} color={pairError ? colors.danger : colors.primary} style={{ height: 10, borderRadius: 999 }} />
            <ProgressRow done={!!ble.connectedDevice} label="BLE connected" />
            <ProgressRow done={!!ble.info} label="Device info loaded" />
            <ProgressRow done={scanComplete} label="LoRa parent scan complete" />
            <ProgressRow done={!!selectedParent} label="Parent selected" />
            <ProgressRow done={pairStarted || pairSending || pairCommandSent} label="Pair request sent" />
            <ProgressRow done={parentAccepted} label="Parent accepted" />
            <ProgressRow done={pairSaved} label="Pairing saved" />
            <ProgressRow done={!!testId || serverTestTimedOut} label={serverTestTimedOut && !testId ? 'Test packet not received yet' : 'Test packet sent'} />
            <ProgressRow done={cloudConfirmed} label="Cloud/Firebase confirmation" />
            {serverTestTimedOut && !testId ? (
              <Text style={{ color: colors.warning, fontWeight: '900' }}>
                Pairing was saved, but the app did not receive the server_test notification within 15 seconds. The child can still be added.
              </Text>
            ) : null}
            {pairError ? <Text selectable style={{ color: colors.danger, fontWeight: '900' }}>{pairError}</Text> : null}
            <SecondaryButton label="Back to Parents" onPress={() => setStep('parents')} />
          </Card.Content>
        </Card>
      ) : null}

      {step === 'success' ? (
        <Card style={{ borderRadius: radius.xl, backgroundColor: '#ECFDF5', ...shadows.soft }}>
          <Card.Content style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <CheckCircle2 size={30} color={colors.success} />
              <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 20, flex: 1 }}>
                {serverTestTimedOut && !testId ? 'Child pairing saved.' : 'Child added successfully.'}
              </Text>
            </View>
            {selectedParent ? (
              <>
                <Text selectable style={{ color: colors.navy, fontWeight: '900' }}>{buildRoutePreview(newDeviceId, selectedParent)}</Text>
                {selectedParent.role === 'RELAY_CANDIDATE' ? (
                  <Text style={{ color: colors.warning, fontWeight: '900' }}>
                    Parent {selectedParent.id} was automatically promoted from child to relay by firmware.
                  </Text>
                ) : null}
                <Text selectable style={{ color: colors.mutedStrong }}>Network ID: {selectedParent.network_id}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Parent ID: {selectedParent.id}</Text>
                <Text selectable style={{ color: colors.mutedStrong }}>Root Gateway ID: {selectedParent.root_gateway_id}</Text>
                <Text style={{ color: colors.mutedStrong }}>Depth: {selectedParent.depth + 1}</Text>
              </>
            ) : null}
            <Text selectable style={{ color: colors.mutedStrong }}>Test packet ID: {testId ?? (serverTestTimedOut ? 'Not received yet' : '-')}</Text>
            <Text style={{ color: colors.navy, fontWeight: '900' }}>Turn both switches back to Normal Mode.</Text>
            <PrimaryButton label="Done" onPress={() => router.replace('/(tabs)/devices')} />
            <SecondaryButton label="Add Another Child" onPress={() => void addAnother()} />
          </Card.Content>
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.md, borderRadius: radius.xl, backgroundColor: colors.card, ...shadows.soft }}>
        <Card.Content style={{ gap: spacing.sm }}>
          <Pressable onPress={() => setDebugOpen((prev) => !prev)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.navy, fontWeight: '900', fontSize: 18 }}>BLE Debug</Text>
            <Text style={{ color: colors.primary, fontWeight: '900' }}>{debugOpen ? 'Hide' : 'Show'}</Text>
          </Pressable>
          {debugOpen ? (
            <>
              <Text selectable style={{ color: colors.mutedStrong }}>Connected device name: {ble.debug.connectedDeviceName ?? '-'}</Text>
              <Text style={{ color: colors.mutedStrong }}>Service UUID found: {ble.debug.serviceFound ? 'Yes' : 'No'}</Text>
              <Text style={{ color: colors.mutedStrong }}>RX characteristic found: {ble.debug.rxFound ? 'Yes' : 'No'}</Text>
              <Text style={{ color: colors.mutedStrong }}>TX characteristic found: {ble.debug.txFound ? 'Yes' : 'No'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Last command: {ble.debug.lastCommand ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Last raw response: {ble.debug.lastRawResponse ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Last decoded response: {ble.debug.lastDecodedResponse ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Raw info lora_ready: {ble.debug.rawInfoLoraReady ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Normalized loraReady: {ble.debug.normalizedInfoLoraReady ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Last info notification: {ble.debug.lastInfoJson ?? '-'}</Text>
              <Text selectable style={{ color: colors.mutedStrong }}>Last parents notification: {ble.debug.lastParentsJson ?? '-'}</Text>
              <Text selectable style={{ color: colors.danger }}>Last error: {ble.debug.lastError ?? '-'}</Text>
              {ble.notifications[0] ? (
                <Text selectable style={{ color: colors.mutedStrong }}>Latest notification: {ble.notifications[0].type}</Text>
              ) : null}
            </>
          ) : null}
        </Card.Content>
      </Card>
    </AppScreen>
  );
}
