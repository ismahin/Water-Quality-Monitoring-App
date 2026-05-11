# AquaNode

**AquaNode** is a UI-first React Native (Expo) prototype for an IoT water quality monitoring system: ponds, gateways, relays, child nodes, calibration, provisioning, alerts, and history — all driven by **local mock data** and **simulated timers**. There is no real BLE, Wi‑Fi provisioning, LoRa, cloud, MQTT, or hardware integration yet.

## Requirements

- Node.js 20+
- npm (this repo uses `.npmrc` with `legacy-peer-deps=true` for SDK 54 peer resolution)

## Installation

```bash
cd D:\Projects\AquaNode
npm install
```

## Run with Expo

```bash
npx expo start
```

Then press `a` (Android), `i` (iOS simulator on macOS), or scan the QR code with **Expo Go**.

## Required packages (from `package.json`)

| Package | Role |
|--------|------|
| `expo` | SDK runtime |
| `expo-router` | File-based navigation |
| `react-native` / `react` | UI |
| `react-native-paper` | Material-style UI |
| `lucide-react-native` | Icons |
| `react-native-svg` | SVG (charts + score ring) |
| `react-native-chart-kit` | Line charts (wrapped in `SensorChart`) |
| `expo-linear-gradient` | Splash / auth gradients |
| `@react-native-async-storage/async-storage` | Mock splash flags (`onboarding`, `session`) |
| `react-native-safe-area-context` / `react-native-screens` / `expo-linking` / `expo-constants` | Router / platform |

## Complete source layout

```
app/
  _layout.tsx
  index.tsx                 # Animated splash → onboarding / login / tabs
  onboarding.tsx
  login.tsx
  signup.tsx
  forgot-password.tsx
  (tabs)/
    _layout.tsx
    dashboard.tsx
    ponds.tsx
    devices.tsx
    alerts.tsx
    settings.tsx
  setup/
    _layout.tsx
    add-device.tsx
    scan-device.tsx
    wifi-provisioning.tsx
    provisioning-success.tsx
    select-device-role.tsx
    add-child-node.tsx
    lora-pairing.tsx
    lora-signal-test.tsx
    calibration-start.tsx
    calibration-ph.tsx
    calibration-tds.tsx
    calibration-turbidity.tsx
    calibration-complete.tsx
  device/
    [id].tsx
    network-tree.tsx
    diagnostics.tsx
    firmware-update.tsx
    sensor-history.tsx
  pond/
    [id].tsx
    add-pond.tsx
  alerts/
    thresholds.tsx
    alert-details.tsx
components/
  AppHeader.tsx
  MetricCard.tsx
  StatusChip.tsx
  WaterQualityScoreCard.tsx
  DeviceStatusCard.tsx
  NetworkTree.tsx
  NodeCard.tsx
  SignalStrengthBar.tsx
  BatteryIndicator.tsx
  SensorChart.tsx
  EmptyState.tsx
  SetupStepCard.tsx
  CalibrationStepCard.tsx
  PrimaryButton.tsx
  SecondaryButton.tsx
  AppScreen.tsx
  SectionTitle.tsx
constants/
  theme.ts
  mockData.ts
context/
  MockAppContext.tsx
types/
  device.ts
  pond.ts
  sensor.ts
  alert.ts
utils/
  statusUtils.ts
  sensorUtils.ts
```

## Where to connect real systems later

Search the codebase for `TODO:`.

| Concern | Suggested hook-in |
|--------|-------------------|
| **BLE scan / permissions** | `app/setup/scan-device.tsx`, `app/setup/add-child-node.tsx` — replace mock list with BLE manager; gate on OS permissions. |
| **Wi‑Fi provisioning** | `app/setup/wifi-provisioning.tsx` — call native/softAP/ESPHome-style flows; reflect real RSSI/IP/cloud reachability. |
| **LoRa pairing** | `app/setup/lora-pairing.tsx`, `app/setup/lora-signal-test.tsx` — exchange keys, join accept, and live RSSI/SNR/packet counters from firmware. |
| **Backend REST** | `context/MockAppContext.tsx`, `constants/mockData.ts` — swap context provider for API + cache (e.g. TanStack Query). |
| **MQTT / Firebase** | `constants/mockData.ts` (header TODO) — stream telemetry + alert push; tie into context reducers. |
| **OTA firmware** | `app/device/firmware-update.tsx` — progress from device task status, checksum, rollback. |
| **Maps / pond layout** | `app/pond/[id].tsx` — map provider + node coordinates from backend. |
| **Calibration persistence** | `app/setup/calibration-start.tsx` — POST calibration records; show server-derived “next due”. |

## Product rules (UI)

- **Gateway / single**: show **Wi‑Fi** SSID/RSSI and cloud status; Wi‑Fi iconography is appropriate.
- **Relay / child**: show **LoRa** parent, RSSI, SNR, packet success; prefer radio/signal visuals — do not imply Wi‑Fi backhaul unless the device is in **single** mode.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run start` | Expo dev server |
| `npm run android` | Open Android |
| `npm run ios` | Open iOS simulator (macOS) |
| `npm run web` | Web (experimental for native-heavy screens) |

## Typecheck

```bash
npx tsc --noEmit
```
