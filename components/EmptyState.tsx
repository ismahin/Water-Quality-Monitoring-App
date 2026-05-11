import { Text, View } from 'react-native';
import {
  AlertTriangle,
  Bluetooth,
  CloudOff,
  Copy,
  MapPin,
  Router,
  Scan,
  Wifi,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../constants/theme';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

export type EmptyStateVariant =
  | 'noPonds'
  | 'noDevices'
  | 'deviceOffline'
  | 'cloudOffline'
  | 'loraNotDetected'
  | 'sensorDisconnected'
  | 'calibrationOverdue'
  | 'weakLora'
  | 'wifiPasswordFailed'
  | 'wifi5ghz'
  | 'blePermission'
  | 'locationPermission'
  | 'noNearbyDevice'
  | 'duplicateNode'
  | 'parentUnavailable'
  | 'gatewayNoLora'
  | 'relayTooManyChildren'
  | 'batteryCritical'
  | 'firmwareFailed'
  | 'syncDelayed'
  | 'generic';

type Props = {
  variant: EmptyStateVariant;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
};

const copy: Record<
  EmptyStateVariant,
  { title: string; body: string; primary?: string; secondary?: string }
> = {
  noPonds: {
    title: 'No ponds yet',
    body: 'Create a pond to organize devices, thresholds, and alerts in one workspace.',
    primary: 'Add pond',
  },
  noDevices: {
    title: 'No devices connected',
    body: 'Add a gateway, relay, child node, or single device to start monitoring water quality.',
    primary: 'Add device',
  },
  deviceOffline: {
    title: 'Device offline',
    body: 'This node has not reported telemetry recently. Check power and antenna placement.',
    primary: 'Run diagnostics',
    secondary: 'View network tree',
  },
  cloudOffline: {
    title: 'Cloud sync paused',
    body: 'Your gateway is online locally, but the cloud endpoint is unreachable.',
    primary: 'Retry sync',
  },
  loraNotDetected: {
    title: 'LoRa module not detected',
    body: 'We could not verify the LoRa radio. Re-seat the module and try pairing again.',
    primary: 'Retry check',
  },
  sensorDisconnected: {
    title: 'Sensor not connected',
    body: 'A probe may be unplugged or damaged. Inspect connectors and cable routing.',
    primary: 'Open diagnostics',
  },
  calibrationOverdue: {
    title: 'Calibration overdue',
    body: 'Buffers drift over time. Run the calibration wizard to restore accuracy.',
    primary: 'Start calibration',
  },
  weakLora: {
    title: 'Weak LoRa signal',
    body: 'Packet success is low. Move the antenna higher and avoid metal obstructions.',
    primary: 'Open signal test',
  },
  wifiPasswordFailed: {
    title: 'Wi‑Fi password failed',
    body: 'The network rejected the credentials. Double-check the password and try again.',
    primary: 'Re-enter password',
  },
  wifi5ghz: {
    title: '5 GHz networks are hidden',
    body: 'ESP32 devices support 2.4 GHz Wi‑Fi. 5 GHz networks will not be shown.',
    primary: 'Choose 2.4 GHz',
  },
  blePermission: {
    title: 'Bluetooth permission required',
    body: 'AquaNode needs Bluetooth access to discover nearby devices during setup.',
    primary: 'Open settings',
  },
  locationPermission: {
    title: 'Location permission required',
    body: 'Android requires location access for BLE scanning. We do not store your location.',
    primary: 'Open settings',
  },
  noNearbyDevice: {
    title: 'No nearby devices found',
    body: 'Wake the device, move closer, and ensure it is in provisioning mode.',
    primary: 'Scan again',
  },
  duplicateNode: {
    title: 'Duplicate node detected',
    body: 'This device ID is already on your network. Remove the old entry or factory reset.',
    primary: 'View devices',
  },
  parentUnavailable: {
    title: 'Parent device unavailable',
    body: 'The selected parent is offline or not accepting new child nodes right now.',
    primary: 'Pick another parent',
  },
  gatewayNoLora: {
    title: 'Gateway has no LoRa module',
    body: 'This gateway SKU does not include LoRa. Add a LoRa-capable gateway to use relays/children.',
    primary: 'Learn more',
  },
  relayTooManyChildren: {
    title: 'Relay child limit reached',
    body: 'This relay already supports the maximum number of downstream nodes.',
    primary: 'Choose another relay',
  },
  batteryCritical: {
    title: 'Battery critically low',
    body: 'Telemetry may stop soon. Replace or recharge the battery before data gaps occur.',
    primary: 'Acknowledge',
  },
  firmwareFailed: {
    title: 'Firmware update failed',
    body: 'The device did not confirm the new image. Keep power stable and retry the update.',
    primary: 'Retry update',
  },
  syncDelayed: {
    title: 'Data sync delayed',
    body: 'Uploads are backing up. Check connectivity and cloud status.',
    primary: 'Retry',
  },
  generic: {
    title: 'Something went wrong',
    body: 'Please try again. If this continues, capture diagnostics and contact support.',
    primary: 'Try again',
  },
};

function VariantIcon({ variant }: { variant: EmptyStateVariant }) {
  const color = colors.primary;
  const size = 22;
  switch (variant) {
    case 'noNearbyDevice':
    case 'blePermission':
      return <Bluetooth size={size} color={color} />;
    case 'wifiPasswordFailed':
    case 'wifi5ghz':
      return <Wifi size={size} color={color} />;
    case 'cloudOffline':
    case 'syncDelayed':
      return <CloudOff size={size} color={color} />;
    case 'duplicateNode':
      return <Copy size={size} color={color} />;
    case 'locationPermission':
      return <MapPin size={size} color={color} />;
    case 'gatewayNoLora':
    case 'deviceOffline':
    case 'parentUnavailable':
      return <Router size={size} color={color} />;
    default:
      return <Scan size={size} color={color} />;
  }
}

export function EmptyState({ variant, onPrimaryPress, onSecondaryPress }: Props) {
  const c = copy[variant] ?? copy.generic;
  return (
    <View
      style={{
        borderRadius: radius.xl,
        padding: spacing.lg,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor: '#E0F2FE',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {variant === 'batteryCritical' || variant === 'firmwareFailed' ? (
            <AlertTriangle size={22} color={colors.danger} />
          ) : (
            <VariantIcon variant={variant} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.navy }}>{c.title}</Text>
          <Text style={{ marginTop: 6, color: colors.mutedStrong, lineHeight: 22, fontSize: 15 }}>{c.body}</Text>
        </View>
      </View>
      {c.primary && onPrimaryPress ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <PrimaryButton label={c.primary} onPress={onPrimaryPress} />
          {c.secondary && onSecondaryPress ? (
            <SecondaryButton label={c.secondary} onPress={onSecondaryPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
