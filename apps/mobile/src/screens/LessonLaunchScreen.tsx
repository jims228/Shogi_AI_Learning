import React, { useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { getRoadmapLessons } from "../data/roadmap";
import { useProgress } from "../state/progress";
import { useSettings } from "../state/settings";

type Props = NativeStackScreenProps<RootStackParamList, "LessonLaunch">;

export function LessonLaunchScreen({ navigation, route }: Props) {
  const { lessonId } = route.params;
  const { markCompleted, setLastPlayed } = useProgress();
  const { settings } = useSettings();
  const completedOnceRef = useRef(false);

  const lesson = useMemo(() => getRoadmapLessons().find((l) => l.id === lessonId) ?? null, [lessonId]);
  const url = useMemo(() => {
    const base = settings.webBaseUrl;
    // Mobile uses a stable, AI-free entry route.
    return `${base}/m/lesson/${encodeURIComponent(lessonId)}?mobile=1&noai=1&lid=${encodeURIComponent(lessonId)}`;
  }, [lessonId, settings.webBaseUrl]);

  if (!lesson || !url) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>レッスンを開けません</Text>
        <Text style={styles.desc}>このレッスンはモバイルMVPでは未対応です。</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        source={{ uri: url }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>読み込み中...</Text>
          </View>
        )}
        onLoadStart={() => setLastPlayed(lessonId)}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#6b7280", fontWeight: "700" },
  title: { marginTop: 24, paddingHorizontal: 16, fontSize: 18, fontWeight: "800", color: "#111827" },
  desc: { marginTop: 8, paddingHorizontal: 16, color: "#6b7280", fontWeight: "600" },
});


