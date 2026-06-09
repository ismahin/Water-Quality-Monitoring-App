# AquaNode

AquaNode is a React Native / Expo app for an ESP32-S3 water quality monitoring system. The current firmware source of truth is WQM Unified Firmware v3.2.8 AutoRelay + SmartRouting, which uses a custom BLE JSON service for pairing, Wi-Fi setup, and LoRa mesh configuration.

## Firmware BLE Contract

Use a real Android development build. Expo Go does not include the native BLE module.

- Device name prefix: `WQMPAIR_`
- Example advertised name: `WQMPAIR_WQM_4EB580`
- Service UUID: `8b6d0001-9d7a-4f5a-a909-5ccbd0e00100`
- RX characteristic, app writes JSON: `8b6d0002-9d7a-4f5a-a909-5ccbd0e00100`
- TX characteristic, firmware sends JSON notifications: `8b6d0003-9d7a-4f5a-a909-5ccbd0e00100`

Commands:

- `{"cmd":"info"}` -> `{"type":"info","ok":true,...}`
- `{"cmd":"set_id","device_id":"M1","network_id":"POND_001"}` -> `{"type":"set_id","ok":true}`
- `{"cmd":"scan_wifi"}` or `{"cmd":"wifi_scan"}` -> `{"type":"wifi_scan","items":[...]}`
- `{"cmd":"set_wifi","ssid":"...","password":"...","gateway":true}` -> `wifi_result` notifications for `connecting`, then `connected` or `failed`
- `{"cmd":"scan"}` -> `{"type":"parents","items":[...]}`
- `{"cmd":"pair","parent_id":"M1","role":"CHILD","network_id":"POND_001"}` -> `pair_started`, `pair_result`, then `server_test`
- `{"cmd":"reset_pair"}`
- `{"cmd":"factory"}`

The app subscribes to TX notifications before writing `info`, then waits briefly before sending the command.

## Firebase Paths

The app checks:

```text
networks/{networkId}/devices/{deviceId}/latest
networks/{networkId}/devices/{deviceId}/status
```

Older `CFG_`, `PROV_`, and `7b7d0001...` BLE provisioning/config flows are not used by the current firmware.

## Installation

```bash
cd path/to/Water-Quality-Monitoring-App
npm install
```

Copy `.env.example` to `.env` and fill the `EXPO_PUBLIC_FIREBASE_*` values from Firebase.

## Run

Start Metro for the installed development build:

```bash
npx expo start --dev-client
```

Build/install on Android:

```bash
npm run android
```

If using ADB manually:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell am start --user current -n com.anonymous.AquaNode/.MainActivity
```

## App Setup Flows

- Add Single / Gateway Device: scan `WQMPAIR_`, read `info`, scan Wi-Fi, send `set_wifi`, and wait for Firebase confirmation.
- Add Child / Extend Network: scan `WQMPAIR_` for the new device only, read `info`, scan LoRa parents with `{"cmd":"scan"}`, send `pair` with role `CHILD`, and wait for `pair_result` plus `server_test`. Parents may be `GATEWAY`, `RELAY`, or `RELAY_CANDIDATE`; relay promotion is automatic in firmware.
- Configure Existing Device: scan `WQMPAIR_`, read info, and send `set_id`, `set_wifi`, `reset_pair`, or `factory`.

## Debug Logs

Useful log prefixes:

- `[AquaNode][BLE_SCAN]`
- `[BLE] Connected`
- `[BLE] Service found`
- `[BLE] RX found`
- `[BLE] TX found`
- `[BLE] TX notification monitor started`
- `[BLE TX->RX] Sending command`
- `[BLE RX<-TX] Decoded`
- `[BLE JSON]`

## Scripts

| Command | Description |
| --- | --- |
| `npm run start` | Expo dev server |
| `npm run android` | Android development build |
| `npm run android:dev` | Android development build |
| `npm run ios` | iOS run command |
| `npm run web` | Web preview, limited for BLE |
| `npm run typecheck` | TypeScript check |
| `npm run eas:android:preview` | EAS preview Android build |
| `npm run eas:android:dev-client` | EAS Android dev client build |
