import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type MobileSettings = {
  webBaseUrl: string;
  apiBaseUrl: string;
};

const STORAGE_KEY = "mobileSettings:v1";

type SettingsContextValue = {
  settings: MobileSettings;
  isLoaded: boolean;
  setWebBaseUrl: (v: string) => void;
  setApiBaseUrl: (v: string) => void;
  resetToDefaults: () => void;
  getSuggestedWebBaseUrlFromExpoHost: () => string | null;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function normalizeBaseUrl(s: string) {
  return (s || "").trim().replace(/\/$/, "");
}

function normalizeWebBaseUrl(s: string) {
  const v = normalizeBaseUrl(s);
  if (Platform.OS === "android" && v.includes("localhost")) {
    return v.replace("localhost", "127.0.0.1");
  }
  return v;
}

function envDefaults(): MobileSettings {
  return {
    webBaseUrl: normalizeWebBaseUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL || "http://localhost:3000"),
    apiBaseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8787"),
  };
}

function expoHostUri(): string | null {
  try {
    // SDKによってフィールドが違うので両方試す（best-effort）
    const cfgHost = (Constants as any)?.expoConfig?.hostUri;
    const host = (Constants as any)?.hostUri;
    const v = typeof cfgHost === "string" ? cfgHost : typeof host === "string" ? host : null;
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function guessLanIpFromHostUri(hostUri: string): string | null {
  // examples:
  // - "192.168.0.12:8081"
  // - "exp://192.168.0.12:8081"
  // - "192.168.0.12:8081/--/..."
  const s = hostUri.replace(/^exp:\/\//, "").replace(/^https?:\/\//, "");
  const hostPart = s.split("/")[0] || "";
  const ip = hostPart.split(":")[0] || "";
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
  return isIp ? ip : null;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<MobileSettings>(envDefaults());
  const [isLoaded, setLoaded] = useState(false);

  const persist = useCallback(async (next: MobileSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const getSuggestedWebBaseUrlFromExpoHost = useCallback((): string | null => {
    const hu = expoHostUri();
    if (!hu) return null;
    const ip = guessLanIpFromHostUri(hu);
    if (!ip) return null;
    return `http://${ip}:3000`;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            const next: MobileSettings = {
              webBaseUrl: normalizeWebBaseUrl(typeof parsed.webBaseUrl === "string" ? parsed.webBaseUrl : envDefaults().webBaseUrl),
              apiBaseUrl: normalizeBaseUrl(typeof parsed.apiBaseUrl === "string" ? parsed.apiBaseUrl : envDefaults().apiBaseUrl),
            };
            setSettings(next);
            // Auto-heal stored localhost on Android
            if (next.webBaseUrl !== parsed.webBaseUrl) {
              void persist(next);
            }
            return;
          }
        }

        // first run: if env is default localhost and we can infer LAN ip, prefer that
        const env = envDefaults();
        const suggested = getSuggestedWebBaseUrlFromExpoHost();
        if (env.webBaseUrl.includes("localhost") && suggested) {
          const next = { ...env, webBaseUrl: suggested };
          setSettings(next);
          void persist(next);
        } else {
          setSettings(env);
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getSuggestedWebBaseUrlFromExpoHost, persist]);

  const setWebBaseUrl = useCallback(
    (v: string) => {
      setSettings((prev) => {
        const next = { ...prev, webBaseUrl: normalizeWebBaseUrl(v) };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const setApiBaseUrl = useCallback(
    (v: string) => {
      setSettings((prev) => {
        const next = { ...prev, apiBaseUrl: normalizeBaseUrl(v) };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetToDefaults = useCallback(() => {
    const next = envDefaults();
    setSettings(next);
    void persist(next);
  }, [persist]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, isLoaded, setWebBaseUrl, setApiBaseUrl, resetToDefaults, getSuggestedWebBaseUrlFromExpoHost }),
    [getSuggestedWebBaseUrlFromExpoHost, isLoaded, resetToDefaults, setApiBaseUrl, setWebBaseUrl, settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}


