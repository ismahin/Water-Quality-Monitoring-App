import { PermissionsAndroid, Platform } from 'react-native';

const LOG_PREFIX = '[AquaNode][BLE]';

function androidApiLevel(): number {
  if (Platform.OS !== 'android') return 0;
  const v = Platform.Version;
  return typeof v === 'number' ? v : parseInt(String(v), 10) || 0;
}

/**
 * Android 12+ (API 31+) requires runtime grants for BLUETOOTH_SCAN and BLUETOOTH_CONNECT.
 * The native provisioning module also requires ACCESS_FINE_LOCATION (see EspIdfProvisioningModule).
 */
export async function requestAndroidBleRuntimePermissions(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (Platform.OS !== 'android') {
    return { ok: true };
  }

  const api = androidApiLevel();
  if (api < 31) {
    console.log(`${LOG_PREFIX} API ${api}: BLUETOOTH_SCAN/CONNECT runtime prompts not required (pre-Android 12).`);
    return { ok: true };
  }

  try {
    console.log(`${LOG_PREFIX} Requesting BLUETOOTH_SCAN + BLUETOOTH_CONNECT (API ${api})`);
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    console.log(`${LOG_PREFIX} Permission results:`, JSON.stringify(results));

    const scan = results['android.permission.BLUETOOTH_SCAN'];
    const connect = results['android.permission.BLUETOOTH_CONNECT'];
    const granted = PermissionsAndroid.RESULTS.GRANTED;

    if (scan !== granted || connect !== granted) {
      const msg = `Bluetooth / Nearby devices access denied (BLUETOOTH_SCAN=${scan}, BLUETOOTH_CONNECT=${connect}). On Android 12+, allow "Nearby devices" or Bluetooth for AquaNode in system Settings → Apps.`;
      console.error(`${LOG_PREFIX}`, msg);
      return { ok: false, message: msg };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} requestMultiple threw:`, e);
    if (e instanceof Error && e.stack) {
      console.error(`${LOG_PREFIX} stack:`, e.stack);
    }
    return { ok: false, message: msg };
  }

  return { ok: true };
}

/**
 * Ensures ACCESS_FINE_LOCATION is granted for the same check the native ESP-IDF module performs
 * (ContextCompat.checkSelfPermission). Call after expo-location so the system dialog is consistent.
 */
export async function requestAndroidFineLocationRuntimePermission(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (Platform.OS !== 'android') {
    return { ok: true };
  }

  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    console.log(`${LOG_PREFIX} ACCESS_FINE_LOCATION result:`, r);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) {
      const msg =
        'Precise location permission is required for BLE provisioning on this build (native module checks ACCESS_FINE_LOCATION). Allow location for AquaNode in Settings.';
      console.error(`${LOG_PREFIX}`, msg);
      return { ok: false, message: msg };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} ACCESS_FINE_LOCATION request threw:`, e);
    return { ok: false, message: msg };
  }

  return { ok: true };
}
