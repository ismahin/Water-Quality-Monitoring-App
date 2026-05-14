import { Linking } from 'react-native';

/**
 * Opens app settings (Bluetooth toggles live in system Settings on both platforms).
 * Avoids extra native modules so dev clients stay compatible without a rebuild.
 */
export async function openBluetoothSystemSettings(): Promise<void> {
  await Linking.openSettings();
}
