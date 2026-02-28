# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RepVelo VBT Coach** is a React Native mobile application for iOS that provides AI-powered Velocity-Based Training (VBT) coaching. It connects to RepVelo Velocity sensors via Bluetooth Low Energy (BLE) to track real-time velocity and power measurements during workouts.

- **Platform**: iOS (iPad supported)
- **Framework**: React Native 0.81 + Expo 54
- **Language**: TypeScript 5.9
- **Package Manager**: pnpm 9.12.0

## Common Commands

```bash
# Development
pnpm dev          # Start both server and mobile dev server ( concurrently )
pnpm dev:server   # Start Express/tRPC backend server only
pnpm dev:metro    # Start Expo Metro bundler for web (port 8081)

# Building
pnpm build        # Build server with esbuild for production
pnpm start        # Start production server
pnpm ios          # Start iOS simulator (requires Xcode)
pnpm android      # Start Android emulator

# Code Quality
pnpm check        # TypeScript type checking ( tsc --noEmit )
pnpm lint         # Run ESLint
pnpm format       # Format code with Prettier

# Testing
pnpm test         # Run Vitest tests

# Database
pnpm db:push      # Generate and run Drizzle migrations
```

## Architecture

### File-Based Routing (Expo Router)

The app uses Expo Router for navigation. Routes are defined by files in the `app/` directory:

- `app/_layout.tsx` - Root layout with providers (tRPC, React Query, Theme, SafeArea)
- `app/(tabs)/` - Tab navigation screens
- `app/oauth/` - OAuth callback handling

Native headers are hidden by default (`headerShown: false`). Enable per-screen if needed.

### State Management (Zustand)

Centralized state is managed in `src/store/trainingStore.ts`. Key state includes:
- `currentSession` - Active training session
- `currentExercise` - Selected exercise
- `liveRepData` - Real-time rep data from BLE
- `isConnectedToBLE` - BLE connection status
- `lvpProfiles` - Load-Velocity Profile data
- `prRecords` - Personal records
- `settings` - App settings (velocity loss threshold, audio feedback, etc.)

### Service Layer

Services follow a singleton pattern and use callback-based event handling:

**BLEService** (`src/services/BLEService.ts`):
- Singleton export: `export default new BLEService()`
- Uses `react-native-ble-plx` for BLE communication
- RepVelo Velocity protocol: 16-byte packets with velocity/power data
- Key methods: `scanForDevices()`, `connectToDevice()`, `startNotifications()`
- Callback interface: `onDataReceived`, `onConnectionStatusChanged`, `onError`, `onDebugInfo`

**OVR Data Protocol** (from BLEService.ts:467):
```
Position 0-1:  Peak Velocity (cm/s) ÷ 100 → m/s
Position 2-3:  Mean Power (W)
Position 4-5:  Peak Power (W)
Position 6-7:  Mean Velocity (cm/s) ÷ 266 → m/s
Position 8-9:  ROM (mm) ÷ 10 → cm
Position 14-15: Rep Duration (ms)
```

### Backend (tRPC + Express)

- Located in `server/_core/`
- Uses tRPC for end-to-end type safety
- Drizzle ORM with SQLite/MySQL
- JWT authentication with `jose`

### Styling (NativeWind)

- Tailwind CSS for React Native
- Theme configured in `theme.config.js`
- Color tokens: `foreground`, `background`, `primary`, `card`, `border`, etc.

## Key Technical Details

### BLE Development

- iOS requires `NSBluetoothAlwaysUsageDescription` in `Info.plist`
- Android requires runtime permissions for BLUETOOTH_SCAN/CONNECT (Android 12+)
- iOS BLE scanning doesn't support UUID filtering (scan all, filter by name)
- OVR devices are identified by name containing "OVR" or "Velocity"

### Testing

- Test runner: Vitest
- Test location: `/tests/` directory
- Current tests are in early stages (mostly skipped)

### Build Deployment

- Uses Manus platform for iOS cloud builds
- TestFlight deployment via `TESTFLIGHT_DEPLOYMENT.md`
- Bundle ID: `space.manus.ovr.vbt.coach.app.t20260125053732`
- iOS deployment target: 13.0+

## Important Files

| File | Purpose |
|------|---------|
| `src/services/BLEService.ts` | BLE communication with OVR sensors |
| `src/store/trainingStore.ts` | Zustand state management |
| `src/types/index.ts` | TypeScript type definitions |
| `app.config.ts` | Expo app configuration |
| `server/routers.ts` | tRPC API routes |
| `design.md` | App design and screen structure |
| `CURRENT_STATUS.md` | Current implementation status |
