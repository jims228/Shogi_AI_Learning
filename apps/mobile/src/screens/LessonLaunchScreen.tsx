import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { getRoadmapLessons } from "../data/roadmap";
import { useProgress } from "../state/progress";
import { useSettings } from "../state/settings";
import { Card, PrimaryButton, Screen } from "../ui/components";
import { theme } from "../ui/theme";

type Props = NativeStackScreenProps<RootStackParamList, "LessonLaunch">;

export function LessonLaunchScreen({ navigation, route }: Props) {
  const { lessonId } = route.params;
  const { markCompleted, setLastPlayed } = useProgress();
  const { settings } = useSettings();
  const completedOnceRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

  const lesson = useMemo(() => getRoadmapLessons().find((l) => l.id === lessonId) ?? null, [lessonId]);
  const url = useMemo(() => {
    const base = settings.webBaseUrl;
    const lid = encodeURIComponent(lessonId);
    // Prefer direct lesson href to avoid the /m/lesson redirect flash.
    if (lesson?.href) {
      const join = lesson.href.includes("?") ? "&" : "?";
      return `${base}${lesson.href}${join}mobile=1&noai=1&lid=${lid}`;
    }
    // Fallback to the mobile entry route.
    return `${base}/m/lesson/${lid}?mobile=1&noai=1&lid=${lid}`;
  }, [lessonId, lesson?.href, settings.webBaseUrl]);

  const injectedBeforeLoad = useMemo(() => {
    if (Platform.OS !== "android") return undefined;
    // Harden Android WebView against autoscale/viewport heuristics (Expo Go can still "feel zoomed").
    return `
      (function() {
        try {
          var head = document.head || document.getElementsByTagName('head')[0];
          if (!head) return;
          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'viewport');
            head.appendChild(meta);
          }
          meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
          // Some Android WebViews apply a non-1 zoom internally; force it back to 1.
          // We do NOT use zoom/transform in the web app itself (hit-testing safety).
          document.documentElement.style.zoom = '1';
          document.body && (document.body.style.zoom = '1');
          document.documentElement.style.webkitTextSizeAdjust = '100%';
          document.documentElement.style.textSizeAdjust = '100%';
          document.body && (document.body.style.webkitTextSizeAdjust = '100%');
        } catch (e) {}
      })();
      true;
    `;
  }, []);

  const retry = useCallback(() => {
    setErrorText(null);
    setReloadKey((k) => k + 1);
  }, []);

  if (!lesson || !url) {
    return (
      <Screen>
        <Text style={styles.title}>レッスンを開けません</Text>
        <Text style={styles.desc}>このレッスンはモバイルMVPでは未対応です。</Text>
      </Screen>
    );
  }

  return (
    <Screen pad={false}>
      <View style={styles.root}>
        {errorText ? (
          <View style={styles.errorWrap}>
            <Card style={styles.errorCard}>
              <Text style={styles.errTitle}>読み込みに失敗しました</Text>
              <Text style={styles.errDesc}>{errorText}</Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <PrimaryButton title="再読み込み" onPress={retry} />
              </View>
              {__DEV__ ? (
                <Text style={styles.debug} selectable>
                  WEB_BASE_URL: {settings.webBaseUrl}
                  {"\n"}lessonId: {lessonId}
                  {"\n"}url: {url}
                </Text>
              ) : null}
            </Card>
          </View>
        ) : null}

        <WebView
          key={`wv:${reloadKey}:${lessonId}`}
          source={{ uri: url }}
          cacheEnabled={false}
          {...(Platform.OS === "android" ? { cacheMode: "LOAD_NO_CACHE" as const } : null)}
          // Android WebView (incl Expo Go) can apply text zoom / viewport scaling heuristics.
          // We hard-pin zoom to remove the "slightly zoomed page" feel.
          {...(Platform.OS === "android"
            ? { textZoom: 100, setBuiltInZoomControls: false, setDisplayZoomControls: false }
            : null)}
          injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>レッスンを読み込み中…</Text>
              {__DEV__ ? (
                <Text style={styles.debug} selectable>
                  WEB_BASE_URL: {settings.webBaseUrl}
                  {"\n"}lessonId: {lessonId}
                </Text>
              ) : null}
            </View>
          )}
          {...(__DEV__
            ? {
                renderError: () => (
                  <View style={styles.loading}>
                    <Text style={styles.debug} selectable>
                      WEB_BASE_URL: {settings.webBaseUrl}
                      {"\n"}lessonId: {lessonId}
                    </Text>
                  </View>
                ),
              }
            : null)}
          onLoadStart={() => {
            setLastPlayed(lessonId);
            setErrorText(null);
          }}
          onError={(e) => {
            const msg = e?.nativeEvent?.description || "WebView error";
            const code = e?.nativeEvent?.code;
            const url2 = e?.nativeEvent?.url || url;
            setErrorText(`WebView error: ${code ?? "?"}\n${msg}\n${url2}`);
          }}
          onHttpError={(e) => {
            const code = e?.nativeEvent?.statusCode;
            const url2 = e?.nativeEvent?.url || "";
            setErrorText(`HTTP error: ${code ?? "?"}\n${url2}`);
          }}
          onNavigationStateChange={(nav) => {
            // Fallback: treat "returned to roadmap" as completion.
            // This keeps the MVP resilient even if postMessage isn't available for some pages.
            try {
              const base = settings.webBaseUrl;
              const nextUrl = (nav?.url || "").replace(base, "");
              if (completedOnceRef.current) return;
              if (nextUrl.startsWith("/learn/roadmap")) {
                completedOnceRef.current = true;
                markCompleted(lessonId);
                navigation.goBack();
              }
            } catch {
              // ignore
            }
          }}
          onMessage={(ev) => {
            try {
              const raw = ev.nativeEvent.data;
              const msg = JSON.parse(raw);
              if (msg?.type === "lessonComplete") {
                completedOnceRef.current = true;
                if (typeof msg.lessonId === "string") markCompleted(msg.lessonId);
                else markCompleted(lessonId);
                navigation.goBack();
              }
            } catch {
              // ignore
            }
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  devBanner: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  devText: { fontSize: 10, color: theme.colors.textMuted, fontWeight: "800" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: theme.spacing.lg },
  loadingText: { color: theme.colors.textMuted, fontWeight: "800" },
  title: { marginTop: 24, paddingHorizontal: theme.spacing.lg, fontSize: 18, fontWeight: "900", color: theme.colors.text },
  desc: { marginTop: 8, paddingHorizontal: theme.spacing.lg, color: theme.colors.textMuted, fontWeight: "700" },

  errorWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg, zIndex: 2 },
  errorCard: { width: "100%", maxWidth: 420 },
  errTitle: { fontSize: 16, fontWeight: "900", color: theme.colors.text },
  errDesc: { marginTop: 8, color: theme.colors.textMuted, fontWeight: "700", lineHeight: 18 },
  debug: { marginTop: 12, fontSize: 11, color: theme.colors.textMuted, fontWeight: "700" },
});


