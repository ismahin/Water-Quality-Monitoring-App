# Stage 1 integration testing checklist

Use this list after a **development build** (BLE does not work in Expo Go).

1. Firmware already uploaded and Wi-Fi provisioning mode ready.
2. Firebase Realtime Database has open test rules (see security note in README).
3. ESP32 serial monitor shows `PROV_WQM_xxxxxx` and POP `12345678`.
4. App scan finds `PROV_WQM_xxxxxx`.
5. App sends SSID/password.
6. ESP32 serial shows Wi-Fi connected.
7. ESP32 uploads to Firebase.
8. Firebase console shows `devices/WQM_xxxxxx/latest` and `devices/WQM_xxxxxx/status`.
9. App dashboard switches from mock metrics to live data when the first `latest` payload arrives.
10. Device details screen shows live Wi-Fi RSSI/IP (from Firebase).
11. Restart ESP32; the app should keep receiving Firebase updates automatically.
12. Remove device from the app; the mock dashboard remains usable.

**Android 12+:** BLE scan requires runtime location permission; the scan screen requests foreground location before scanning.

## Wrong Wi-Fi password (auth failure)

Prerequisites: ESP32-S3 in BLE provisioning mode, advertising `PROV_WQM_xxxxxx`, POP `12345678`, dev build on phone.

1. From the app, scan and select the provisioning device.
2. On **Wi-Fi provisioning**, pick the **correct 2.4 GHz SSID** the ESP can see.
3. Enter a **deliberately wrong** Wi-Fi password and tap **Connect device**.
4. **Expected ESP32 serial** (wording may vary by firmware): a failure line indicating wrong Wi-Fi password / auth failure (e.g. `[FAIL]` with reason related to authentication).
5. **Expected app behavior:**
   - Stays on the Wi-Fi provisioning screen (does not return to the BLE scan list).
   - Selected SSID and device name unchanged.
   - **Progress** card stops; a **red error card** appears: *Wrong Wi-Fi password. Please check and try again.*
   - Password field is **cleared** and **focused** again.
   - Primary button label is **Try again**; user can enter the correct password and connect again.
6. Enter the **correct** password and tap **Try again** / **Connect device**.
7. **Expected:** provisioning completes, app navigates to **Provisioning success**, device is registered, and Firebase live data appears on the dashboard after telemetry arrives.

**Expo Go / mock provisioning:** With `EXPO_PUBLIC_MOCK_PROVISIONING=true` (or Expo Go), Wi-Fi password **`wrong`** or **`1234`** simulates `WIFI_AUTH_ERROR`; any other password succeeds after a short delay (for UI testing without hardware).

## Remove device with Firebase stream (`reset_wifi` + ACK)

Prerequisites: ESP32 listens via Firebase REST streaming on `devices/{deviceId}/commands/reset_wifi`. Firmware writes ACK to `devices/{deviceId}/commands/reset_wifi_ack` with `command_id` and `status: "accepted"`. Dev build; Realtime Database rules allow client write to `reset_wifi` and read `reset_wifi_ack`. The app **never** deletes `devices/{deviceId}` during this flow.

### Happy path

1. ESP32 is connected and the command stream is healthy (Serial shows stream connected if your firmware logs it).
2. App shows the device under **Live Devices**; open device details.
3. Tap **Remove device** (or **Remove / Re-pair** on relay). Confirm the dialog.
4. App writes `devices/{deviceId}/commands/reset_wifi` with `requested: true`, `command_id` like `remove_<timestamp>`, `reason: "removed_from_app"`, `requested_by: "mobile_app"`, `requested_at` (server timestamp).
5. Firebase shows `devices/{deviceId}/commands/reset_wifi/requested === true` (until firmware sets `requested` false / `handled` true).
6. **ESP32 serial (expected patterns, wording may vary):** `[STREAM]` put/patch, `[CMD] reset_wifi` from stream, `command_id: remove_…`, clearing Wi‑Fi credentials, restart.
7. Firmware writes `devices/{deviceId}/commands/reset_wifi_ack` with `status: "accepted"` and matching `command_id`.
8. App receives the ACK (10s listener), updates `app_state` (`removed`, `removed_at`, `remove_command_id`), removes the device from local **registeredDevices** / AsyncStorage, navigates to **Devices**, snackbar: *Device removed. It is ready for provisioning again.*
9. ESP32 restarts, drops old Wi‑Fi, and returns to BLE provisioning (`PROV_…`).
10. App can add / provision the device again.

### Failure: device offline / no ACK

1. Power off the ESP32 (or block network).
2. In the app, open the live device and tap **Remove device** → confirm.
3. App sends the reset command, then waits **10 seconds** for ACK.
4. **Expected:** dialog *Device did not confirm reset. It may be offline. Remove locally anyway?* with **Cancel** and **Remove locally**.
5. **Remove locally:** device is removed from the app list only; Firebase `devices/{deviceId}` is **not** deleted; snackbar warns that reset may not have reached the device.

### Firebase errors

If the command write fails (rules, network, misconfiguration), the app shows an error snackbar (*Could not send reset command. Check Firebase permissions and network.*) and does **not** remove the device from the app.

## Hardware mode: SINGLE vs GATEWAY (toggle)

Prerequisites: dev build, Firebase configured, one provisioned device publishing `latest` and `status`.

### Test 1: Single mode

1. Put the hardware toggle in **SINGLE** position.
2. Confirm ESP32 / Firebase shows `role` **SINGLE** (e.g. in `devices/{id}/status`).
3. **Expected app:** dashboard **Single Device Mode**; LoRa status **Disabled**; device list shows standalone copy for the live device.

### Test 2: Gateway mode with LoRa connected

1. Put the toggle in **LORA / gateway** position; serial shows SX1278 initialized.
2. Firebase `status.role` **GATEWAY** (and LoRa ready flags true).
3. **Expected app:** **Gateway Mode** / gateway chip; **LoRa Gateway Ready** summary; cyan-style success card on device detail where applicable.

### Test 3: Gateway mode without LoRa module

1. Remove or disconnect the LoRa module; toggle to LORA position.
2. Serial shows LoRa init failed; Firebase `lora_gateway_ready` **false**.
3. **Expected app:** **LoRa Module Error** card with wiring hint (SX1278, 3.3V, SPI, antenna).

### Test 4: Switch live update

1. Open **device detail** for the live device.
2. Flip toggle **SINGLE → LORA** (or vice versa) without leaving the screen.
3. **Expected:** role chips and mode / LoRa sections update automatically from Firebase within a few seconds.

### Test 5: Remove gateway device

1. Device in **Gateway** mode; open device detail.
2. Tap **Remove device**; confirm (note gateway warning about child reporting).
3. App writes `reset_wifi`, waits for ACK, removes local registration only (does not delete `devices/{id}`).
4. **Expected:** ESP32 clears Wi‑Fi and returns to BLE provisioning; app navigates away and device disappears from live list.
