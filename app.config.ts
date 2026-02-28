// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Bundle ID format: com.autecouture.<project_name_dots>
const bundleId = "com.autecouture.repvelocoach";
// Extract timestamp from bundle ID for deep link scheme if present, otherwise use default
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `repvelocoach${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "RepVelo Coach",
  appSlug: "repvelo-coach-app",
  // URL of the app logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "https://s3.amazonaws.com/manus-assets/repvelo-coach/icon.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "2.3.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    buildNumber: "7",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSBluetoothAlwaysUsageDescription:
        "This app uses Bluetooth to connect to RepVelo Velocity sensors for real-time velocity tracking during your workouts.",
      NSBluetoothPeripheralUsageDescription:
        "This app uses Bluetooth to connect to RepVelo Velocity sensors.",
      NSCameraUsageDescription:
        "This app uses the camera to record your workout videos for form analysis.",
      NSMicrophoneUsageDescription:
        "This app uses the microphone for voice commands during your workouts.",
      NSPhotoLibraryUsageDescription:
        "This app saves workout videos to your photo library.",
      NSLocationWhenInUseUsageDescription:
        "This app may use location services for enhanced training features.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1a1a1a",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "POST_NOTIFICATIONS",
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "BLUETOOTH_SCAN",
      "BLUETOOTH_CONNECT",
      "ACCESS_FINE_LOCATION",
      "CAMERA",
      "RECORD_AUDIO",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#1a1a1a",
        dark: {
          backgroundColor: "#1a1a1a",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
        },
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
    [
      "react-native-ble-plx",
      {
        isBackgroundEnabled: true,
        modes: ["peripheral", "central"],
        bluetoothAlwaysPermission:
          "Allow RepVelo Coach to connect to RepVelo Velocity sensors",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "b6bbbf14-ff1d-4914-854c-3c88f0fb6bf7",
    },
  },
};

export default config;
