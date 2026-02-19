import React, { useCallback, useMemo } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

const LESSON_ICONS_IMG = require("../../assets/lesson-icons.png");
// 2x2 sprite sheet, each icon is 64x64 in a 128x128 image
// order: [star, round, crown, heart]
const ICON_POSITIONS = [
  { col: 0, row: 0 }, // star     (top-left)
  { col: 1, row: 0 }, // round    (top-right)
  { col: 0, row: 1 }, // crown    (bottom-left)
  { col: 1, row: 1 }, // heart    (bottom-right)
] as const;
const ICON_SRC_SIZE = 64;   // each icon is 64x64 in the source PNG
const ICON_RENDER = 82;     // render size on screen
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getFlatRoadmapItems, type FlatRoadmapItem } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Card, PrimaryButton, Screen } from "../ui/components";
import { theme } from "../ui/theme";
import { useSakuraBurst } from "../ui/effects/SakuraBurstProvider";

type Props = NativeStackScreenProps<RootStackParamList, "RoadmapHome">;

function shortenTitle(s: string) {
  const t = (s || "").trim();
  if (!t) return "レッスン";
  // drop bracketed suffixes like （Lv1）, （復習）, etc.
  const noParen = t.replace(/（.*?）/g, "").trim();
  // shorten common prefix
  const noPrefix = noParen.replace(/^基本の駒の動き/, "").trim();
  return noPrefix || noParen || t;
}

const LESSON_BROWN = "#6d4c41";
const LESSON_BROWN_DARK = "#3e2723";
const BOARD_BG = "#FFEEDB";



export function RoadmapHomeScreen({ navigation }: Props) {
  const { progress, isLoaded } = useProgress();
  const items = useMemo(() => getFlatRoadmapItems(), []);
  const completedSet = useMemo(() => new Set(progress.completedLessonIds), [progress.completedLessonIds]);
  const sakura = useSakuraBurst();

  const continueLessonId = useMemo(() => {
    const last = progress.lastPlayedLessonId;
    if (last && items.some((l) => l.lessonId === last && !l.locked)) return last;
    const next = items.find((l) => !l.locked && !completedSet.has(l.lessonId));
    return next?.lessonId ?? null;
  }, [completedSet, items, progress.lastPlayedLessonId]);

  const continueLesson = useMemo(() => {
    if (!continueLessonId) return null;
    return items.find((l) => l.lessonId === continueLessonId) ?? null;
  }, [continueLessonId, items]);

  const nextLessonId = useMemo(() => {
    const next = items.find((l) => !l.locked && !completedSet.has(l.lessonId));
    return next?.lessonId ?? null;
  }, [completedSet, items]);

  const offsets = useMemo(() => [-60, -30, 0, 30, 60, 30, 0, -30], []);

  const renderItem = useCallback(
    ({ item, index }: { item: FlatRoadmapItem; index: number }) => {
      const done = completedSet.has(item.lessonId);
      const isNext = !item.locked && item.lessonId === nextLessonId;
      const dx = offsets[index % offsets.length] ?? 0;

      // Orange coin icon: cycle through 4 types; locked uses muted coin
      const iconPos = ICON_POSITIONS[index % ICON_POSITIONS.length];
      // locked: desaturate with low opacity; done: slight dim
      const coinOpacity = item.locked ? 0.45 : done ? 0.8 : 1;

      return (
        <View style={[styles.nodeRow, { transform: [{ translateX: dx }] }]}>
          {isNext ? (
            <View style={styles.startTag}>
              <Text style={styles.startTagText}>START</Text>
            </View>
          ) : null}

          <Pressable
            disabled={item.locked}
            onPressIn={(e) => {
              if (item.locked) return;
              sakura.spawn(e.nativeEvent.pageX, e.nativeEvent.pageY);
            }}
            onPress={() => navigation.navigate("LessonLaunch", { lessonId: item.lessonId })}
            hitSlop={10}
            style={({ pressed }) => ({
              width: ICON_RENDER,
              height: ICON_RENDER,
              borderRadius: 999,
              alignItems: "center" as const,
              justifyContent: "center" as const,
              opacity: coinOpacity,
              transform: pressed && !item.locked ? [{ scale: 0.93 }] : [],
            })}
          >
            {/* Sprite crop: overflow:hidden clips to one icon */}
            <View style={{ width: ICON_RENDER, height: ICON_RENDER, overflow: "hidden", borderRadius: 999 }}>
              <Image
                source={LESSON_ICONS_IMG}
                style={{
                  width: ICON_RENDER * 2,
                  height: ICON_RENDER * 2,
                  marginLeft: -(iconPos.col * ICON_RENDER),
                  marginTop: -(iconPos.row * ICON_RENDER),
                }}
                resizeMode="stretch"
              />
            </View>
            {done && !item.locked ? (
              <View pointerEvents="none" style={[styles.doneBadge, { bottom: 0 }]}>
                <Text style={styles.doneBadgeText}>✓</Text>
              </View>
            ) : null}
          </Pressable>

          <Text style={[styles.nodeTitle, item.locked && { color: theme.colors.textMuted }]} numberOfLines={2}>
            {shortenTitle(item.title)}
          </Text>
        </View>
      );
    },
    [completedSet, navigation, nextLessonId, offsets, sakura],
  );

  return (
    <Screen style={{ backgroundColor: BOARD_BG }} contentStyle={{ paddingTop: 4 }}>
      {/* Roadmap-only: burst on any tap in this screen (bubble or blank space). */}
      <View
        style={{ flex: 1 }}
        onTouchStart={(e) => {
          // This does not run on other screens (WebView/board).
          sakura.spawn(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }}
      >
      {!isLoaded ? <Text style={[styles.subtle, { marginTop: 6 }]}>読み込み中...</Text> : null}

      {continueLesson ? (
        <Card style={styles.continueCard}>
          <Text style={styles.cardEyebrow}>つづきから</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{continueLesson.title}</Text>
          <Text style={styles.cardSub} numberOfLines={2}>
            {continueLesson.subtitle || "次のレッスンを始めましょう。"}
          </Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <PrimaryButton
              title="レッスンを開く"
              onPress={() => navigation.navigate("LessonLaunch", { lessonId: continueLesson.lessonId })}
              buttonStyle={styles.continueBtn}
            />
          </View>
        </Card>
      ) : null}

        <View style={styles.roadmapWrap}>
          <FlatList
            data={items}
            keyExtractor={(l) => l.lessonId}
            contentContainerStyle={{ paddingTop: theme.spacing.lg, paddingBottom: 80 }}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 28 }} />}
          />
        </View>

        {/* 設定ボタン: 右下に固定 */}
        <Pressable
          onPress={() => navigation.navigate("Settings")}
          style={styles.settingsBtn}
          hitSlop={10}
        >
          <Text style={styles.linkText}>設定</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtle: { marginTop: 6, color: theme.colors.textMuted, fontWeight: "700" },
  linkText: { fontWeight: "900", color: "#374151" },
  settingsBtn: {
    position: "absolute",
    bottom: theme.spacing.md,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(255,255,255,0.75)",
    minHeight: 44,
    justifyContent: "center",
  },

  continueCard: { marginTop: 0 },
  cardEyebrow: { ...theme.typography.sub, color: theme.colors.textMuted },
  cardTitle: { marginTop: 6, fontSize: 18, fontWeight: "900", color: theme.colors.text, letterSpacing: 0.2 },
  cardSub: { marginTop: 8, color: theme.colors.textMuted, fontWeight: "700", lineHeight: 18 },

  roadmapWrap: { flex: 1, marginTop: theme.spacing.xs },

  nodeRow: { alignItems: "center", justifyContent: "center" },
  bubble: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.card,
  },
  bubbleDone: {},
  bubbleNext: {
    shadowColor: LESSON_BROWN,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  bubbleIcon: { fontSize: 22, fontWeight: "900" },
  nodeTitle: { marginTop: 8, maxWidth: 220, textAlign: "center", fontSize: 13, fontWeight: "900", color: theme.colors.text },

  doneBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: LESSON_BROWN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.surface,
    ...theme.shadow.card,
  },
  doneBadgeText: { color: "#fff", fontWeight: "900", fontSize: 14, lineHeight: 14 },

  startTag: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  startTagText: { fontSize: 11, fontWeight: "900", color: LESSON_BROWN_DARK, letterSpacing: 0.4 },
  continueBtn: { backgroundColor: "#DB6010", borderBottomColor: "#a04508" },
});


