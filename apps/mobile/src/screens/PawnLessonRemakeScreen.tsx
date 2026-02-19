import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
  LESSON_FOOTER_HEIGHT,
} from "../ui/lesson";
import { theme } from "../ui/theme";

const TOTAL_STEPS = 5;
const MASCOT_SIZE = 210;
/** 画面左にはみ出す量 (正=左にずらす) */
const MASCOT_PULL_LEFT = 30;
const MASCOT_OFFSET_Y = 8;
const BOARD_SAFETY = Platform.OS === "android" ? -50 : 0;
const INSET = Platform.OS === "android" ? 4 : 2;

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
  const [boardSlotSize, setBoardSlotSize] = useState({ w: 0, h: 0 });
  const { width: windowWidth } = useWindowDimensions();

  const progress = (stepIndex + 1) / TOTAL_STEPS;
  const isLastStep = stepIndex >= TOTAL_STEPS - 1;
  const nextLabel = isLastStep ? "レッスン完了！" : "次へ";

  const url = useMemo(() => {
    const base = settings.webBaseUrl;
    return `${base}/training/basics/pawn?mobile=1&noai=1&embed=1&lid=${encodeURIComponent(lessonId)}`;
  }, [lessonId, settings.webBaseUrl]);

  const riveAvatarUrl = useMemo(() => `${settings.webBaseUrl}/m/rive-avatar`, [settings.webBaseUrl]);

  const boardSize = useMemo(() => {
    const h = Math.floor(boardSlotSize.h);
    // 画面幅から BoardArea の水平パディング(16*2)と右端の余白(20)を引いた上限
    const maxW = Math.floor(windowWidth - 16 * 2 - 20);
    if (!h || !maxW) return 320;
    const s = Math.min(maxW, h) - BOARD_SAFETY;
    return Math.max(240, s);
  }, [boardSlotSize.h, windowWidth]);

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
          var css = document.createElement('style');
          css.type = 'text/css';
          css.appendChild(document.createTextNode(
            'html, body { margin:0 !important; padding:0 !important; height:100% !important; overflow:hidden !important; background:transparent !important; }' +
            '#__next, #root { height:100% !important; }'
          ));
          (document.head || document.documentElement).appendChild(css);
        } catch (e) {}
      })();
      true;
    `;
  }, []);

  const injectedBoardNoScroll = useMemo(() => {
    return `
      (function(){
        try{
          var style = document.createElement('style');
          style.type = 'text/css';
          style.appendChild(document.createTextNode(
            'html, body { overflow:hidden !important; overscroll-behavior:none !important; margin:0 !important; padding:0 !important; }' +
            '* { overscroll-behavior:none !important; }'
          ));
          (document.head || document.documentElement).appendChild(style);

          var lock = function(){ try{ window.scrollTo(0,0); }catch(e){} };
          lock();
          window.addEventListener('scroll', lock, { passive: true });

          var stop = function(e){ try{ e.preventDefault(); } catch(_) {} };
          document.addEventListener('touchmove', stop, { passive: false });
          document.addEventListener('wheel', stop, { passive: false });
        }catch(e){}
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

  // NOTE: __avatarCorrect() の Rive アニメーションがキャラ位置をずらす原因のため無効化。
  // Riveファイル側のアニメーション修正後に再度有効化する。
  const bounceAnim = useRef(new Animated.Value(1)).current;

  // おじいちゃん: /m/rive-avatar を WebView で表示。
  // useMemo で安定化: isCorrect など無関係な state が変わっても再レンダーしない。
  // これにより topSection のレイアウト再計算が起きず、キャラ位置がブレない。
  const characterSlot = useMemo(() => (
    <Animated.View
      style={[
        styles.riveWrap,
        { marginLeft: -MASCOT_PULL_LEFT, marginTop: MASCOT_OFFSET_Y },
        { transform: [{ scale: bounceAnim }] },
      ]}
    >
      <WebView
        ref={(r) => {
          avatarWebViewRef.current = r;
        }}
        source={{ uri: riveAvatarUrl }}
        style={styles.riveWebView}
        containerStyle={styles.riveWebViewContainer}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        cacheEnabled={false}
        androidLayerType="hardware"
        {...(Platform.OS === "android"
          ? { cacheMode: "LOAD_NO_CACHE" as const, textZoom: 100, overScrollMode: "never" as const }
          : null)}
      />
    </Animated.View>
  ), [riveAvatarUrl, bounceAnim]);

  // dialogueMessage が変わった時だけ DialogueRow を再レンダー。
  // isCorrect などが変わっても topSection のレイアウト計算を走らせない。
  const dialogueRowNode = useMemo(() => (
    <DialogueRow
      message={dialogueMessage}
      characterSlot={characterSlot}
      characterWidth={MASCOT_SIZE - MASCOT_PULL_LEFT}
      style={{ paddingRight: 8, gap: 10, height: MASCOT_SIZE }}
      bubbleStyle={{ marginBottom: 80, flex: 0, alignSelf: "flex-end", maxWidth: "60%", marginLeft: -48 }}
    />
  ), [dialogueMessage, characterSlot]);

  return (
    <Screen pad={false} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.root}>
        <LessonHeader progress={progress} onClose={onClose} />
        <View style={styles.content}>
          <View style={styles.topSection}>
            <View style={styles.contentTopSpacer} />
            <InstructionTitle text="パズルを解いてください" />
            {dialogueRowNode}
          </View>
          <BoardArea style={styles.boardArea}>
            <View
              style={styles.boardSlot}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                const w = Math.floor(width);
                const h = Math.floor(height);
                setBoardSlotSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
              }}
            >
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>盤面を読み込み中…</Text>
                </View>
              )}
              <View style={[styles.webViewWrap, { width: boardSize, height: boardSize, padding: INSET }, loading && styles.webViewHidden]}>
                <WebView
                  ref={(r) => {
                    webViewRef.current = r;
                  }}
                  source={{ uri: url }}
                  style={[styles.webView, { width: boardSize - INSET * 2, height: boardSize - INSET * 2 }]}
                  cacheEnabled={false}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  androidLayerType={Platform.OS === "android" ? "software" : undefined}
                  {...(Platform.OS === "android"
                    ? { cacheMode: "LOAD_NO_CACHE" as const, textZoom: 100, overScrollMode: "never" as const }
                    : null)}
                  injectedJavaScriptBeforeContentLoaded={(injectedBeforeLoad ?? "") + "\n" + injectedBoardNoScroll}
                  onLoadEnd={() => setLoading(false)}
                  onMessage={onMessage}
                  scrollEnabled={false}
                  nestedScrollEnabled={false}
                />
              </View>
            </View>
          </BoardArea>
        </View>
        <LessonFooter nextLabel={nextLabel} onNext={onNext} disabled={!isCorrect} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFEEDB" },
  content: { flex: 1, paddingBottom: LESSON_FOOTER_HEIGHT, overflow: "visible" },
  topSection: { overflow: "visible" },
  contentTopSpacer: { height: 2 },
  boardArea: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 0,
    marginTop: -40,
  },
  boardSlot: {
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    height: "100%",
  },
  webViewWrap: {
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  webViewHidden: { opacity: 0 },
  webView: {
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: "700",
  },
  riveWrap: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    overflow: "hidden",   // アニメーション中にWebViewが膨らんでも外に漏れない
    flexShrink: 0,
  },
  riveWebViewContainer: {
    backgroundColor: "transparent",
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
  },
  riveWebView: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    backgroundColor: "transparent",
  },
});
