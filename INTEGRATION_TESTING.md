# WQM Firmware v3.2.17 Integration Testing

Current firmware source of truth: WQM Unified Firmware v3.2.17 Reliable Queue + BLE v2 + Remote Commands.

Use a real Android development build. BLE does not work in Expo Go.

## BLE Scan And Info

1. Put the ESP32 switch in Pairing Mode.
2. Confirm the blue LED is blinking.
3. Confirm Serial Monitor shows an advertised name like `WQMPAIR_WQM_4EB580`.
4. In the app, open Add Device -> Add Single / Gateway Device.
5. Scan should show `WQMPAIR_<deviceId>`. If Android omits the name but includes the WQMPAIR service UUID, the app should show a fallback `WQMPAIR_...` entry.
6. Select the device.
7. Serial Monitor should print `BLE APP CONNECTED`.
8. App should subscribe to TX notifications before sending `{"v":2,"cmd_id":"app_...","cmd":"info","args":{}}`.
9. Serial Monitor should show a v2 info command with top-level `v`, `cmd_id`, `cmd`, and `args`.
10. App should display `device_id`, `network_id`, role, switch mode, LoRa ready, Wi-Fi connected, paired state, firmware, BLE protocol, and offline queue fields.

Expected info response includes:

```json
{
  "v": 2,
  "type": "info",
  "protocol": "wqm_ble_v2",
  "offline_firebase_queue_size": 0,
  "offline_queue_ready": true
}
```

## Gateway Wi-Fi Setup

1. After info loads, app sends `{"v":2,"cmd_id":"app_...","cmd":"scan_wifi","args":{}}`.
2. Firmware returns `{"type":"wifi_scan","items":[{"ssid","rssi","secure"}]}`.
3. Select an SSID, or manually type one if scan is unavailable.
4. Enter password if the network is secure.
5. Tap Connect to Wi-Fi.
6. Serial Monitor should show `{"v":2,"cmd_id":"app_...","cmd":"set_wifi","args":{"ssid":"...","password":"...","gateway":true}}`.
7. App should show `wifi_result` stage `connecting`.
8. App should wait for `wifi_result` stage `connected` with IP, or `failed` with message.
9. App should confirm Firebase data at `networks/{networkId}/devices/{deviceId}/latest` or `status`.
10. On success, turn the device switch back to Normal Mode.

## Add Child / Extend Network

1. Put the new child node in Pairing Mode.
2. Put the existing gateway, relay, or child parent in Pairing Mode.
3. In the app, open Add Device -> Add Child / Extend Network.
4. Scan and select the new `WQMPAIR_` device.
5. Do not connect to the old parent device; the parent is discovered by LoRa.
6. App validates the new device is in Pairing Mode and LoRa is ready.
7. App sends `{"v":2,"cmd_id":"app_...","cmd":"scan","args":{}}`. It must not send `scan_wifi`.
8. Firmware returns `{"type":"parents","items":[...]}` with `GATEWAY`, `RELAY`, or `RELAY_CANDIDATE` parents.
9. Select parent and pair. App sends `{"v":2,"cmd_id":"app_...","cmd":"pair","args":{"parent_id":"...","role":"CHILD","network_id":"..."}}`.
10. If the parent is `RELAY_CANDIDATE`, firmware automatically promotes it from child to relay.
11. Firmware returns `pair_started`, then `pair_result` with `stage:"saved"`, then `server_test`.
12. App shows the final route and Firebase confirmation if available.

## Remote Commands

1. Open a live device details screen.
2. Tap `Read now`; app writes `sample_now` to both command inbox paths when `networkId` is known.
3. Confirm Firebase contains:

```text
devices/{deviceId}/commands/inbox/{commandId}
networks/{networkId}/devices/{deviceId}/commands/inbox/{commandId}
```

4. Confirm the command object has `v: 2`, `command_id`, `cmd`, `requested: true`, `handled: false`, `args`, `source: "AquaNodeApp"`, and `created_at`.
5. Confirm the app receives an ack from one of:

```text
devices/{deviceId}/commands/acks/{commandId}
networks/{networkId}/devices/{deviceId}/commands/acks/{commandId}
```

6. Test `set_interval` with a valid interval such as `30000`.
7. Test `restart`, `reset_wifi`, and `reset_pair`; each must show a confirmation dialog.
8. Test `clear_offline_queue` only after reading the warning; it deletes unsynced local data.
9. If no ack appears within the timeout, the app should show a remote command timeout.

## Offline Queue

1. Connect gateway to Wi-Fi and verify Firebase data.
2. Turn Wi-Fi/router off.
3. Wait for at least two upload intervals.
4. App should show offline queue count increasing after BLE `info` refresh.
5. Turn Wi-Fi/router on.
6. App should show queue count decreasing back to 0.
7. Firebase should contain the replayed data.

## Configure Existing Device

1. Put the device in Pairing Mode.
2. Open Configure Existing Device.
3. Scan and connect to `WQMPAIR_`.
4. Confirm info is displayed, including firmware, BLE protocol, and queue status.
5. Test `set_id`, `set_wifi`, `reset_pair`, `clear_wifi`, and `factory` only when needed.

## Debug Logs

Expected app logs during a healthy connection:

```text
[AquaNode][BLE_SCAN] Matched AquaNode device name="WQMPAIR_..."
[BLE] Connected: ...
[BLE] Service found: true 8b6d0001-9d7a-4f5a-a909-5ccbd0e00100
[BLE] RX found: true 8b6d0002-9d7a-4f5a-a909-5ccbd0e00100
[BLE] TX found: true 8b6d0003-9d7a-4f5a-a909-5ccbd0e00100
[BLE] TX notification monitor started
[BLE TX->RX] Sending command: {"v":2,"cmd_id":"app_...","cmd":"info","args":{}}
[BLE RX<-TX] Decoded: {"v":2,"type":"info","protocol":"wqm_ble_v2",...}
[BLE JSON] ...
```
