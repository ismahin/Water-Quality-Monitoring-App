# WQM Firmware v3.2.8 Integration Testing

Use a real Android development build. BLE does not work in Expo Go.

## BLE Scan And Info

1. Put the ESP32 switch in Pairing Mode.
2. Confirm the blue LED is blinking.
3. Confirm Serial Monitor shows an advertised name like `WQMPAIR_WQM_4EB580`.
4. In the app, open Add Device -> Add Single / Gateway Device.
5. Scan should show `WQMPAIR_<deviceId>`. If Android omits the name but includes the WQMPAIR service UUID, the app should show a fallback `WQMPAIR_...` entry.
6. Select the device.
7. Serial Monitor should print `BLE APP CONNECTED`.
8. App should subscribe to TX notifications before sending `{"cmd":"info"}`.
9. Serial Monitor should show `[BLEPAIR RX] {"cmd":"info"}`.
10. App should display `device_id`, `network_id`, role, switch mode, LoRa ready, Wi-Fi connected, and paired state.

## Gateway Wi-Fi Setup

1. After info loads, app sends `{"cmd":"scan_wifi"}`.
2. Firmware returns `{"type":"wifi_scan","items":[{"ssid","rssi","secure"}]}`.
3. Select an SSID, or manually type one if scan is unavailable.
4. Enter password if the network is secure.
5. Tap Connect to Wi-Fi.
6. Serial Monitor should show the `set_wifi` command.
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
7. App sends `{"cmd":"scan"}`. It must not send `scan_wifi`.
8. Firmware returns `{"type":"parents","items":[...]}` with `GATEWAY`, `RELAY`, or `RELAY_CANDIDATE` parents.
9. Select parent and pair. App sends `{"cmd":"pair","parent_id":"...","role":"CHILD","network_id":"..."}`.
10. If the parent is `RELAY_CANDIDATE`, firmware automatically promotes it from child to relay.
11. Firmware returns `pair_started`, then `pair_result` with `stage:"saved"`, then `server_test`.
12. App shows the final route and Firebase confirmation if available.

## Configure Existing Device

1. Put the device in Pairing Mode.
2. Open Configure Existing Device.
3. Scan and connect to `WQMPAIR_`.
4. Confirm info is displayed.
5. Test `set_id`, `set_wifi`, `reset_pair`, and `factory` only when needed.

## Debug Logs

Expected app logs during a healthy connection:

```text
[AquaNode][BLE_SCAN] Matched AquaNode device name="WQMPAIR_..."
[BLE] Connected: ...
[BLE] Service found: true 8b6d0001-9d7a-4f5a-a909-5ccbd0e00100
[BLE] RX found: true 8b6d0002-9d7a-4f5a-a909-5ccbd0e00100
[BLE] TX found: true 8b6d0003-9d7a-4f5a-a909-5ccbd0e00100
[BLE] TX notification monitor started
[BLE TX->RX] Sending command: {"cmd":"info"}
[BLE RX<-TX] Decoded: {"type":"info",...}
[BLE JSON] ...
```
