import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ScanDeviceRedirect() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <Redirect href={mode === 'config' ? '/setup/pairing-config' : '/setup/gateway-wifi-setup'} />;
}

