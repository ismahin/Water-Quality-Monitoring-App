# AquaNode

**AquaNode** is a React Native (Expo) app for an IoT water quality monitoring system. **Stage 1** adds real **BLE Wi‑Fi provisioning** for a single ESP32-S3 (ESP-IDF provisioning) and **live telemetry** from **Firebase Realtime Database**, while keeping ponds, alerts, thresholds, LoRa flows, and multi-node demos as **mock** data.

Repository: [Water-Quality-Monitoring-App](https://github.com/ismahin/Water-Quality-Monitoring-App) (local path may differ).

## Requirements

- Node.js 20+
- npm (this repo may use `.npmrc` with `legacy-peer-deps=true` for SDK 54 peer resolution)
- **Development build** for BLE provisioning (not Expo Go). See [Real integration — Stage 1](#real-integration--stage-1).

## Installation

```bash
cd path/to/Water-Quality-Monitoring-App
npm install
```

## Environment (Firebase)

1. Copy `.env.example` to `.env` in the project root.
2. Fill all `EXPO_PUBLIC_FIREBASE_*` values from the Firebase console (Web app config). These are **client** keys only — never commit service account JSON or private keys.
3. Restart Metro after changing `.env`.

If keys are missing in development, the app throws a clear error when Firebase config is read (see `constants/env.ts`).

## Run with Expo (JS only / Expo Go)

```bash
npx expo start
```

Expo Go can run the app UI, but **native BLE provisioning is unavailable** in Expo Go. Set `EXPO_PUBLIC_MOCK_PROVISIONING=true` in `.env` to simulate scan/provision in Expo Go, or use a development build for real hardware.

## Real integration — Stage 1

**Firmware (ESP32-S3)** currently writes to Realtime Database:

- `devices/{device_id}/latest` — sensor readings, Wi‑Fi hints, battery, etc.
- `devices/{device_id}/status` — online, Wi‑Fi, IP, etc.

**Provisioning:** device advertises as `PROV_WQM_xxxxxx` with PoP `12345678` (adjust in app if your firmware differs). The app uses `@orbital-systems/react-native-esp-idf-provisioning` with **`ESPSecurity.secure` (Security 1)** and PoP. If your firmware uses Security 2, you must pass a **username** with `connect()` — adjust `services/provisioning/espProvisioningService.ts` after checking serial logs.

**App behavior:**

- Registers **one** live provisioned device in AsyncStorage (`@aquanode/registeredDevices`). The device’s **role** (single vs gateway) is taken from Firebase (`status.role` / `latest.role`) and updates live when the hardware mode toggle changes—no re-provisioning required.
- Merges that device into the global device list and **pond-a** device IDs for the dashboard.
- Dashboard and device detail use Firebase when `latest` and/or `status` exists; otherwise shows a waiting state.
- LoRa **child** pairing and relay demo flows stay mock (see TODOs in those screens).

### Device modes

- **SINGLE:** Wi‑Fi standalone monitor; firmware role `SINGLE`.
- **GATEWAY:** Wi‑Fi monitor plus SX1278 (Ra‑02) LoRa receiver when initialization succeeds; firmware role `GATEWAY`.

**Firmware writes** (under `devices/{deviceId}/`):

- `status/role`, `status/hardware_mode`
- `status/lora_enabled`, `status/lora_initialized`, `status/lora_gateway_ready`, `status/lora_packet_count`
- Sensor snapshots and overlapping fields in `latest/` (see `types/firebase.ts`).

**App behavior:**

- Live dashboard and device detail subscribe to **`latest`** and **`status`**; flipping the hardware toggle updates the displayed role automatically.
- **LoRa Gateway Ready** means the SX1278 module initialized (module OK).
- A **LoRa RF link to a child** is only implied after **`lora_packet_count`** increases; packet count `0` means no child packets yet (child pairing UI is not implemented).

### Native packages

```bash
npx expo install firebase @orbital-systems/react-native-esp-idf-provisioning expo-dev-client expo-location
```

Already reflected in `package.json` after install.

### Development build (Android example)

`npx expo run:android` only works when **an emulator is running** or a **phone is connected with USB debugging** enabled. If you see “No Android connected device found”, use one of the options below.

#### Option A — Install on your phone without USB (recommended): EAS Build APK

Cloud build produces an **APK** you open on your phone and install (sideload). This is a real native app with BLE — not Expo Go.

1. Install EAS CLI and log in:

   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Create an Expo account project link (once):

   ```bash
   eas init
   ```

3. **Set Firebase env on the build server** (Expo Go / local `.env` is not used on EAS unless you wire it). Either:
   - In [expo.dev](https://expo.dev) → your project → **Environment variables**, add each `EXPO_PUBLIC_FIREBASE_*` key from `.env.example`, **or**
   - `eas secret:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."` (repeat for all required keys — see `constants/env.ts`).

4. Build a **preview** APK (standalone; no USB needed):

   ```bash
   npm run eas:android:preview
   ```

   When the build finishes, open the build page on expo.dev and **download the .apk** to your phone, then allow “Install unknown apps” for your browser/files app and install.

5. Optional — **development client** APK (connects to Metro on your PC for hot reload):

   ```bash
   npm run eas:android:dev-client
   ```

   After install, run `npx expo start --dev-client` on your PC and open the app on the phone (same Wi‑Fi).

#### Option B — Local debug APK (Android Studio / SDK on your PC)

After `npx expo prebuild`:

```bash
cd android
.\gradlew.bat assembleDebug
```

Install `android\app\build\outputs\apk\debug\app-debug.apk` by copying it to the phone (USB, Drive, etc.). You need JDK and Android SDK configured.

If Gradle reports **`SDK location not found`**, add `android/local.properties` with your SDK path (from Android Studio → **Settings → Android SDK → Android SDK location**):

```properties
sdk.dir=C:/Users/YourName/AppData/Local/Android/Sdk
```

If Gradle reports **`SDK location not found`**, add `android/local.properties` with your SDK path (from Android Studio → **Settings → Android SDK → Android SDK location**):

```properties
sdk.dir=C:/Users/YourName/AppData/Local/Android/Sdk
```

Or set the **`ANDROID_HOME`** environment variable to that folder.

**BLE scan on Android 12+:** the app requests **Nearby devices** permissions (`BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT`) before scanning. If scan still fails, check Metro / Logcat for lines prefixed with `[AquaNode][scan-device]` or `[AquaNode][ESP]`.

**Wi‑Fi provisioning errors:** failures from the ESP-IDF stack are normalized to codes (`WIFI_AUTH_ERROR`, `WIFI_AP_NOT_FOUND`, `PROVISION_TIMEOUT`, `BLE_DISCONNECTED`, `UNKNOWN_ERROR`) in `espProvisioningService.ts`. The Wi‑Fi screen shows targeted copy (wrong password, AP not found, timeout, BLE disconnect) and clears the password after any failure. The full BLE connect + credential send + join flow is bounded by a **45 second** timeout.

**Mock / Expo Go:** when native provisioning is unavailable, use `EXPO_PUBLIC_MOCK_PROVISIONING=true` for UI work. Wi‑Fi passwords **`wrong`** or **`1234`** simulate an auth failure; other passwords simulate success after a few seconds.

### Security (important)

- **Do not** leave Realtime Database rules open in production.
- Plan for **Firebase Auth** or **backend-issued device tokens** before shipping.
- The app must **never** embed service account private keys.

## Required packages (high level)

| Package | Role |
|--------|------|
| `expo` / `expo-router` | App shell, navigation |
| `firebase` | Realtime Database client (modular SDK) |
| `@orbital-systems/react-native-esp-idf-provisioning` | ESP-IDF BLE / SoftAP provisioning (BLE used here) |
| `expo-dev-client` | Development builds with native modules |
| `expo-location` | Android foreground location for BLE scan permission flow |
| `@react-native-async-storage/async-storage` | Onboarding, session, registered device persistence |
| `react-native-paper`, `lucide-react-native`, … | UI |

## Source layout (high level)

```
app/                    # Expo Router screens
constants/env.ts       # Validates EXPO_PUBLIC_FIREBASE_*
context/MockAppContext.tsx   # Mock + live merge (useMockApp unchanged by name)
hooks/useLiveDevice.ts
hooks/useFirebaseConnectionStatus.ts
hooks/useProvisioning.ts
services/firebase/      # firebaseClient, firebaseConfig, deviceTelemetryService
services/provisioning/espProvisioningService.ts
types/firebase.ts
types/registeredDevice.ts
```

## Where to connect real systems later

| Concern | Status / next step |
|--------|---------------------|
| **BLE Wi‑Fi provisioning (single device)** | Implemented (`espProvisioningService`, setup screens, structured errors + 45s timeout, wrong-password UX). LoRa remains TODO. |
| **Firebase live telemetry (single device)** | Implemented (`deviceTelemetryService`, `MockAppContext` listeners). |
| **LoRa pairing / relays / children** | Still mock / TODO in existing screens. |
| **Real sensors / calibration from hardware** | Firmware-side; app maps `calibration_status` for display. |
| **Sensor history charts** | Still mock until firmware writes timestamped history — see TODO in `app/device/sensor-history.tsx`. |
| **Backend REST / auth** | Future: replace or augment context with API + tokens. |

## Scripts

| Command | Description |
|--------|-------------|
| `npm run start` | Expo dev server |
| `npm run android` | `expo start --android` |
| `npm run android:dev` | `expo run:android` (native dev build) |
| `npm run ios` | `expo start --ios` |
| `npm run web` | Web (limited for BLE) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run eas:android:preview` | EAS cloud build → **APK** for sideload (no USB) |
| `npm run eas:android:dev-client` | EAS build → dev client APK + Metro |

## Integration testing

See [INTEGRATION_TESTING.md](INTEGRATION_TESTING.md).

## Typecheck

```bash
npm run typecheck
```
