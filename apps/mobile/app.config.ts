import type { ExpoConfig } from "expo/config";

const APP_NAME = "Shogi Roadmap";
const SLUG = "shogi-roadmap";
const SCHEME = "shogiroadmap";

// NOTE:
// - Update these before real production distribution.
// - They must be globally unique on iOS.
const IOS_BUNDLE_ID = "com.jims228.shogiroadmap";
const ANDROID_PACKAGE = "com.jims228.shogiroadmap";

const config: ExpoConfig = {
  name: APP_NAME,
  slug: SLUG,
  scheme: SCHEME,
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    // MVP: allow loading http://<LAN IP>:3000 in WebView.
    // For production, prefer HTTPS and tighten ATS.
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // MVP: allow loading http://... in WebView
    usesCleartextTraffic: true,
  } as any,
  web: {
    favicon: "./assets/favicon.png",
  },
};

export default config;


