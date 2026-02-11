import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { useProgress } from "../state/progress";
import { useSettings } from "../state/settings";
import { Screen } from "../ui/components";
import {
  LessonHeader,
  InstructionTitle,
  DialogueRow,
  BoardArea,
  LessonFooter,
} from "../ui/lesson";
import { theme } from "../ui/theme";

const TOTAL_STEPS = 5;
/** Mascot size to match web MobileLessonShell (ManRive 210x210). */
const MASCOT_SIZE = 210;

type Props = NativeStackScreenProps<RootStackParamList, "LessonLaunch">;

export function PawnLessonRemakeScreen({ navigation, route }: Props) {
  const { lessonId } = route.params;
  const { markCompleted } = useProgress();
  const { settings } = useSettings();
  const webViewRef = useRef<WebView | null>(null);
  const avatarWebViewRef = useRef<WebView | null>(null);
  const completedOnceRef = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [stepTitle, setStepTitle] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);

  const progress = (stepIndex + 1) / TOTAL_STEPS;
  const isLastStep = stepIndex >= TOTAL_STEPS - 1;
  const nextLabel = isLastStep ? "レッスン完了！" : "次へ";

  const url = useMemo(() => {
    const base = settings.webBaseUrl;
    const join = "/training/basics/pawn".includes("?") ? "&" : "?";
    return `${base}/training/basics/pawn${join}mobile=1&noai=1&embed=1&lid=${encodeURIComponent(lessonId)}`;
  }, [lessonId, settings.webBaseUrl]);

  const riveAvatarUrl = useMemo(() => `${settings.webBaseUrl}/m/rive-avatar`, [settings.webBaseUrl]);

  const injectedBeforeLoad = useMemo(() => {
    if (Platform.OS !== "android") return undefined;
    return `
      (function() {
        try {
          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            var head = document.head || document.getElementsByTagName('head')[0];
            if (head) {
              meta = document.createElement('meta');
              meta.setAttribute('name', 'viewport');
              head.appendChild(meta);
            }
          }
          if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
          document.documentElement.style.zoom = '1';
          document.body && (document.body.style.zoom = '1');
        } catch (e) {}
      })();
      true;
    `;
  }, []);

  const onClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const onNext = useCallback(() => {
    if (isLastStep) {
      if (!completedOnceRef.current) {
        completedOnceRef.current = true;
        markCompleted(lessonId);
      }
      navigation.goBack();
      return;
    }
    // Tell WebView to advance step; it will send stepChanged and we sync stepIndex from that
    webViewRef.current?.injectJavaScript(
      "typeof window.__rnLessonNext === 'function' && window.__rnLessonNext(); true;"
    );
    setIsCorrect(false);
  }, [isLastStep, lessonId, markCompleted, navigation]);

  const onMessage = useCallback(
    (ev: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(ev.nativeEvent.data);
        if (msg?.type === "lessonCorrect") {
          setIsCorrect(true);
        }
        if (msg?.type === "stepChanged") {
          if (typeof msg.stepIndex === "number") setStepIndex(msg.stepIndex);
          setStepTitle(msg.title ?? "");
          setStepDescription(msg.description ?? "");
        }
      } catch {
        // ignore
      }
    },
    []
  );

  const dialogueMessage = stepDescription || stepTitle || "問題に答えてね。";

  // Fire Rive "surprise" when user gets correct (same as other lessons using ManRive).
  useEffect(() => {
    if (!isCorrect) return;
    avatarWebViewRef.current?.injectJavaScript(
      "typeof window.__avatarCorrect === 'function' && window.__avatarCorrect(); true;"
    );
  }, [isCorrect]);

  // おじいちゃん: 他レッスンと同じ ManRive (/anime/man.riv) を WebView で表示（/m/rive-avatar が描画）
  const characterSlot = (
    <View style={styles.riveWrap}>
      <WebView
        ref={(r) => {
          avatarWebViewRef.current = r;
        }}
        source={{ uri: riveAvatarUrl }}
        style={styles.riveWebView}
        scrollEnabled={false}
        cacheEnabled={false}
        {...(Platform.OS === "android"
          ? { cacheMode: "LOAD_NO_CACHE" as const, textZoom: 100 }
          : null)}
      />
    </View>
  );

  return (
    <Screen pad={false} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.root}>
        <LessonHeader progress={progress} onClose={onClose} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentTopSpacer} />
          <InstructionTitle text="パズルを解いてください" />
          <DialogueRow
            message={dialogueMessage}
            characterSlot={characterSlot}
            characterWidth={MASCOT_SIZE}
          />
          <BoardArea>
            {loading && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>盤面を読み込み中…</Text>
              </View>
            )}
            <View style={[styles.webViewWrap, loading && styles.webViewHidden]}>
              <WebView
                ref={(r) => {
                  webViewRef.current = r;
                }}
                source={{ uri: url }}
                style={styles.webView}
                cacheEnabled={false}
                {...(Platform.OS === "android"
                  ? { cacheMode: "LOAD_NO_CACHE" as const, textZoom: 100 }
                  : null)}
                injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
                onLoadEnd={() => setLoading(false)}
                onMessage={onMessage}
                scrollEnabled={false}
              />
            </View>
          </BoardArea>
        </ScrollView>
        <LessonFooter nextLabel={nextLabel} onNext={onNext} disabled={!isCorrect} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  contentTopSpacer: { height: 8 },
  webViewWrap: {
    width: "100%",
    minHeight: 360,
    borderRadius: 8,
    overflow: "hidden",
  },
  webViewHidden: { opacity: 0, position: "absolute", left: 0, right: 0 },
  webView: {
    width: "100%",
    minHeight: 360,
    backgroundColor: "transparent",
  },
  loadingWrap: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: "700",
  },
  riveWrap: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  riveWebView: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    backgroundColor: "transparent",
  },
});
