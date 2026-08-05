# Copilot instructions - Watteco Easy Codec (token-efficient map)

## Goal
Work fast with minimal token usage.
Prioritize `src/` and avoid broad scans of the full repository unless explicitly requested.

## Scope first
- Main work area: `src/`
- Secondary context: `public/config/`, `localisation/`, `package.json`, `build.md`
- Ignore by default: `osaCmacTest/`, `patches/`, `LE_SECURE_CONNEXIONS.md`, `android/build/`, `ios/App/App/public/`, `dist/`, `node_modules/`

## Tech snapshot
- Stack: Vue 3 + Ionic Vue + TypeScript + Vite + Capacitor
- BLE plugin: `@capacitor-community/bluetooth-le` (Capacitor)
- Routing mode:
  - Native platform -> starts on BLE connection page
  - Web platform -> goes directly to downlink tab

## Source map (what each area does)

### App shell and navigation
- `src/main.ts`: app bootstrap, Ionic + router init
- `src/App.vue`: root shell with `ion-router-outlet`
- `src/router/index.ts`: native/web route split and tabs routing
- `src/views/TabsPage.vue`: top header + tab container

### BLE flow (high priority area)
- `src/composables/useBle.ts`: core BLE state machine and operations
  - init, scan, auto-scan, connect/disconnect
  - characteristic discovery (FE60 family fallback)
  - write queue and chunking
  - retry strategy + bond/pairing recovery (Android)
  - user-facing status + event logs
- `src/views/BleConnectPage.vue`: BLE connect UI
  - device scan/select
  - pairing banner/status
  - skip BLE button in debug mode

### BLE debug and tooling
- `src/composables/useBleDebug.ts`: debug orchestration (panel state + actions)
- `src/components/ble/BleDebugPanel.vue`: debug UI surface
- `src/utils/BLE/connection.ts`: service/characteristic discovery + subscriptions + dumps
- `src/utils/BLE/blob.ts`: BLE value parsing, read/write helpers
- `src/utils/BLE/osa.ts`: OSA challenge helpers
- `src/utils/BLE/configReader.ts`: model/firmware auto-fetch via BLE frames
- `src/utils/BLE/characteristics.ts`: UUID constants and matching helpers

### Main functional UI
- `src/views/DownlinkPage.vue`: primary product workflow
  - sensor selection
  - dynamic parameter forms (general/modbus/batch)
  - frame generation/display and BLE send integration
- `src/views/ModbusPage.vue`: Modbus frame builder
- `src/views/UplinkPage.vue`, `src/views/BatteryPage.vue`: placeholders currently

### Reusable UI components
- `src/components/`: dynamic form controls
  - `CheckBox.vue`, `DropDown.vue`, `NumInput.vue`, `FloatInput.vue`, `Slider.vue`, `TimeSlider.vue`, etc.
- `src/components/LanguageSwitcher.vue`: locale switch UI

### Config and localization sources
- `public/config/`: sensor JSON catalogs and product configs
- `localisation/en_US.json`, `localisation/fr_FR.json`: UI messages

## Practical edit guide (where to change)
- BLE pairing/connection/auth issues:
  - first: `src/composables/useBle.ts`
  - then: `src/views/BleConnectPage.vue` for UX/status
- BLE debug commands/logs:
  - `src/composables/useBleDebug.ts`
  - `src/utils/BLE/*`
- Dynamic sensor form behavior:
  - `src/views/DownlinkPage.vue`
  - `src/components/*` for control-level behavior
- Localization key missing:
  - `localisation/*.json` + usage in Vue files
- Sensor model-specific params:
  - `public/config/*.json`

## Build and run shortcuts
- Web dev: `npm run dev`
- Android sync flow: `npm run android`
- Android debug BLE UI: `npm run android:debug`
- iOS web build + sync: `npm run ios`

## Token-efficient workflow for agents
1. Read only `src/router/index.ts` + target view/composable first.
2. If BLE topic, jump directly to `src/composables/useBle.ts`.
3. Read only the exact helper in `src/utils/BLE/` referenced by imports.
4. Avoid reading full large files if only one function is targeted.
5. Do not inspect ignored folders unless user explicitly asks.

## Current BLE reality (important)
- BLE logic has been modularized under `src/utils/BLE/` for debug/subscription/OSA/config-read helpers.
- `DownlinkPage` uses wrappers and should keep stable template/API when possible.
- BLE debug UI visibility is controlled by env:
  - shown in dev
  - or when `VITE_ENABLE_BLE_DEBUG=true`
- Android secure pairing/bonding handling exists in `src/composables/useBle.ts` and should be preserved when refactoring.
