import { Redirect } from 'expo-router';

export default function ConfigDeviceRedirect() {
  return <Redirect href="/setup/pairing-config" />;
}

