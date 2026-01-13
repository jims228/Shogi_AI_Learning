import React, { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getFlatRoadmapItems, type FlatRoadmapItem } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Card, PrimaryButton, Screen } from "../ui/components";
import { theme } from "../ui/theme";

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

export function RoadmapHomeScreen({ navigation }: Props) {
  const { progress, isLoaded } = useProgress();
  const items = useMemo(() => getFlatRoadmapItems(), []);
  const completedSet = useMemo(() => new Set(progress.completedLessonIds), [progress.completedLessonIds]);

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

  const offsets = useMemo(() => [-30, 0, 30, 0, -18, 18, 0], []);

  const renderItem = useCallback(
    ({ item, index }: { item: FlatRoadmapItem; index: number }) => {
      const done = completedSet.has(item.lessonId);
      const isNext = !item.locked && item.lessonId === nextLessonId;
      const dx = offsets[index % offsets.length] ?? 0;

      const fill = item.locked ? "#f3f4f6" : isNext ? theme.colors.brand : done ? theme.colors.surface : theme.colors.surface;
      const ring = item.locked ? "#d1d5db" : isNext ? theme.colors.brandDark : done ? theme.colors.brandDark : theme.colors.border;
      const ringW = isNext ? 4 : done ? 3 : 2;
      // Center icon policy:
      // - locked: 🔒
      // - playable (next/available/completed): ▶
      // Completed is shown via ring/badge, not by swapping the center icon.
      const icon = item.locked ? "🔒" : "▶";
      const iconColor = item.locked ? "#6b7280" : isNext ? "#fff" : theme.colors.brandDark;

      return (
        <View style={[styles.nodeRow, { transform: [{ translateX: dx }] }]}>
          {isNext ? (
            <View style={styles.startTag}>
              <Text style={styles.startTagText}>START</Text>
            </View>
          ) : null}

          <Pressable
            disabled={item.locked}
            onPress={() => navigation.navigate("LessonLaunch", { lessonId: item.lessonId })}
            hitSlop={10}
            style={({ pressed }) => [
              styles.bubble,
              { backgroundColor: fill, borderColor: ring, borderWidth: ringW },
              isNext && styles.bubbleNext,
              done && !isNext && !item.locked && styles.bubbleDone,
              pressed && !item.locked && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              item.locked && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.bubbleIcon, { color: iconColor }]}>{icon}</Text>
            {done && !item.locked ? (
              <View pointerEvents="none" style={styles.doneBadge}>
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
    [completedSet, navigation, nextLessonId, offsets],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>ロードマップ</Text>
          <Text style={styles.subtle}>今日の学習を1つだけ進めよう</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Settings")} style={styles.linkBtn} hitSlop={10}>
          <Text style={styles.linkText}>設定</Text>
        </Pressable>
      </View>

      {!isLoaded ? <Text style={[styles.subtle, { marginTop: 6 }]}>読み込み中...</Text> : null}

      {continueLesson ? (
        <Card style={styles.continueCard}>
          <Text style={styles.cardEyebrow}>つづきから</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{continueLesson.title}</Text>
          <Text style={styles.cardSub} numberOfLines={2}>
            {continueLesson.subtitle || "次のレッスンを始めましょう。"}
          </Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <PrimaryButton title="レッスンを開く" onPress={() => navigation.navigate("LessonLaunch", { lessonId: continueLesson.lessonId })} />
          </View>
        </Card>
      ) : null}

      <View style={styles.roadmapWrap}>
        <View pointerEvents="none" style={styles.pathLine} />
        <FlatList
          data={items}
          keyExtractor={(l) => l.lessonId}
          contentContainerStyle={{ paddingTop: theme.spacing.lg, paddingBottom: 72 }}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 22 }} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: theme.spacing.md },
  h1: { ...theme.typography.h1, color: theme.colors.text },
  subtle: { marginTop: 6, color: theme.colors.textMuted, fontWeight: "700" },
  linkBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: theme.radius.md, backgroundColor: "#f3f4f6", minHeight: 44, justifyContent: "center" },
  linkText: { fontWeight: "900", color: "#374151" },

  continueCard: { marginTop: theme.spacing.sm },
  cardEyebrow: { ...theme.typography.sub, color: theme.colors.textMuted },
  cardTitle: { marginTop: 6, fontSize: 18, fontWeight: "900", color: theme.colors.text, letterSpacing: 0.2 },
  cardSub: { marginTop: 8, color: theme.colors.textMuted, fontWeight: "700", lineHeight: 18 },

  roadmapWrap: { flex: 1, marginTop: theme.spacing.lg },
  pathLine: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 6,
    marginLeft: -3,
    backgroundColor: theme.colors.surfaceTint,
    borderRadius: 999,
    opacity: 0.7,
  },

  nodeRow: { alignItems: "center", justifyContent: "center" },
  bubble: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.card,
  },
  bubbleDone: { backgroundColor: theme.colors.surfaceTint },
  bubbleNext: {
    shadowColor: theme.colors.brand,
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
    backgroundColor: theme.colors.brand,
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
  startTagText: { fontSize: 11, fontWeight: "900", color: theme.colors.brandDark, letterSpacing: 0.4 },
});


