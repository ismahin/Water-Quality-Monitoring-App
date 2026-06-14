# AquaNode

AquaNode is a React Native / Expo app for an ESP32-S3 water quality monitoring system.

Current firmware source of truth: WQM Unified Firmware v3.2.17 Reliable Queue + BLE v2 + Remote Commands.

## Firmware BLE Contract

Use a real Android development build. Expo Go does not include the native BLE module.

- Device name prefix: `WQMPAIR_`
- Example advertised name: `WQMPAIR_WQM_4EB580`
- Service UUID: `8b6d0001-9d7a-4f5a-a909-5ccbd0e00100`
- RX characteristic, app writes JSON: `8b6d0002-9d7a-4f5a-a909-5ccbd0e00100`
- TX characteristic, firmware sends JSON notifications: `8b6d0003-9d7a-4f5a-a909-5ccbd0e00100`

The app sends only BLE v2 command envelopes:

```json
{"v":2,"cmd_id":"app_...","cmd":"info","args":{}}
```

Commands:

- `{"v":2,"cmd_id":"app_...","cmd":"info","args":{}}` -> `{"v":2,"type":"info","protocol":"wqm_ble_v2","ok":true,...}`
- `{"v":2,"cmd_id":"app_...","cmd":"set_id","args":{"device_id":"M1","network_id":"POND_001"}}` -> `{"type":"set_id","ok":true}`
- `{"v":2,"cmd_id":"app_...","cmd":"scan_wifi","args":{"max_results":12}}` -> `{"type":"wifi_scan","items":[...]}`
- `{"v":2,"cmd_id":"app_...","cmd":"wifi_status","args":{}}`
- `{"v":2,"cmd_id":"app_...","cmd":"set_wifi","args":{"ssid":"...","password":"...","gateway":true}}` -> `wifi_result` notifications for `connecting`, then `connected` or `failed`
- `{"v":2,"cmd_id":"app_...","cmd":"scan","args":{}}` -> `{"type":"parents","items":[...]}`
- `{"v":2,"cmd_id":"app_...","cmd":"pair","args":{"parent_id":"M1","role":"CHILD","network_id":"POND_001"}}` -> `pair_started`, `pair_result`, then `server_test`
- `{"v":2,"cmd_id":"app_...","cmd":"clear_wifi","args":{}}`
- `{"v":2,"cmd_id":"app_...","cmd":"reset_pair","args":{}}`
- `{"v":2,"cmd_id":"app_...","cmd":"factory","args":{}}`

Expected `info` fields include:

```json
{
  "v": 2,
  "type": "info",
  "protocol": "wqm_ble_v2",
  "offline_firebase_queue_size": 0,
  "offline_queue_ready": true
}
```

The app accepts older notifications and v2 `cmd_ack` messages, including pairing lifecycle stages such as `PAIR_ACCEPTED_WAITING_ACK`, `PAIR_SAVED_WAITING_TEST`, and `ACTIVE`.

The app subscribes to TX notifications before writing `info`, then waits briefly before sending the command.

## Firebase Paths

Firebase Schema v4 paths:

```text
networks/{networkId}/devices/{deviceId}/latest
networks/{networkId}/devices/{deviceId}/status
networks/{networkId}/devices/{deviceId}/identity
networks/{networkId}/devices/{deviceId}/link
networks/{networkId}/gateways/{gatewayId}/children/{childId}/latest
networks/{networkId}/gateways/{gatewayId}/children/{childId}/status
networks/{networkId}/topology/{deviceId}
networks/{networkId}/devices/{deviceId}/commands/inbox/{commandId}
networks/{networkId}/devices/{deviceId}/commands/acks/{commandId}
```

Legacy compatibility paths still work:

```text
devices/{deviceId}/latest
devices/{deviceId}/status
devices/{gatewayId}/children/{childId}/latest
devices/{gatewayId}/children/{childId}/status
devices/{gatewayId}/network/{childId}
devices/{deviceId}/commands/inbox/{commandId}
devices/{deviceId}/commands/acks/{commandId}
```

Remote commands are written to both inbox paths when a network ID is known. Supported app controls are `sample_now`, `set_interval`, `restart`, `reset_wifi`, `reset_pair`, and `clear_offline_queue`.

Child pairing lifecycle labels:

- `PAIR_ACCEPTED_WAITING_ACK`: Pairing accepted, waiting for child ACK
- `PAIR_SAVED_WAITING_TEST`: Paired, waiting for first data
- `ACTIVE`: Active

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
- Add Child / Extend Network: scan `WQMPAIR_` for the new device only, read `info`, scan LoRa parents with BLE v2 `scan`, send BLE v2 `pair` with role `CHILD`, and accept `pair_result.ok === true` or `cmd_ack` stage `PAIR_SAVED_WAITING_TEST` as successful pairing. Parents may be `GATEWAY`, `RELAY`, or `RELAY_CANDIDATE`; relay promotion is automatic in firmware. Children remain visible while waiting for first telemetry.
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
