import { Redirect } from 'expo-router';

export default function WifiProvisioningRedirect() {
  return <Redirect href="/setup/gateway-wifi-setup" />;
}

