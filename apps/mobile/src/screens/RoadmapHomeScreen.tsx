import React, { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getRoadmapLessons } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Card, ListRow, PrimaryButton, ProgressPill, Screen } from "../ui/components";
import { theme } from "../ui/theme";

type Props = NativeStackScreenProps<RootStackParamList, "RoadmapHome">;

type UnitRow = {
  category: string;
  title: string;
  total: number;
  completed: number;
  firstIndex: number;
};

function categoryTitle(category: string) {
  if (category === "basics") return "基本";
  if (category === "tsume-1") return "詰将棋（1手詰）";
  if (category === "tsume-2") return "詰将棋（中盤）";
  if (category === "tsume-3") return "詰将棋（終盤）";
  return category;
}

export function RoadmapHomeScreen({ navigation }: Props) {
  const { progress, isLoaded } = useProgress();
  const lessons = useMemo(() => getRoadmapLessons().slice().sort((a, b) => a.index - b.index), []);
  const completedSet = useMemo(() => new Set(progress.completedLessonIds), [progress.completedLessonIds]);

  const units = useMemo<UnitRow[]>(() => {
    const byCat = new Map<string, { total: number; completed: number; firstIndex: number }>();
    for (const l of lessons) {
      const cat = l.category || "unknown";
      const curr = byCat.get(cat) ?? { total: 0, completed: 0, firstIndex: l.index ?? 999999 };
      curr.total += 1;
      if (completedSet.has(l.id)) curr.completed += 1;
      curr.firstIndex = Math.min(curr.firstIndex, l.index ?? 999999);
      byCat.set(cat, curr);
    }
    return Array.from(byCat.entries())
      .map(([category, v]) => ({
        category,
        title: categoryTitle(category),
        total: v.total,
        completed: v.completed,
        firstIndex: v.firstIndex,
      }))
      // Preserve original ordering (by first appearance in the web LESSONS array)
      .sort((a, b) => a.firstIndex - b.firstIndex);
  }, [completedSet, lessons]);

  const continueLessonId = useMemo(() => {
    const last = progress.lastPlayedLessonId;
    if (last && lessons.some((l) => l.id === last && l.href)) return last;
    const next = lessons.find((l) => l.href && !completedSet.has(l.id));
    return next?.id ?? null;
  }, [completedSet, lessons, progress.lastPlayedLessonId]);

  const continueLesson = useMemo(() => {
    if (!continueLessonId) return null;
    return lessons.find((l) => l.id === continueLessonId) ?? null;
  }, [continueLessonId, lessons]);

  const renderItem = useCallback(
    ({ item }: { item: UnitRow }) => {
      return (
        <Card style={styles.unitCard} onPress={() => navigation.navigate("UnitDetail", { category: item.category })}>
          <ListRow title={item.title} subtitle="レッスン一覧" leftIcon="📚" rightText={`${item.completed}/${item.total}`} onPress={() => navigation.navigate("UnitDetail", { category: item.category })} />
          <View style={{ marginTop: theme.spacing.sm, alignSelf: "flex-start" }}>
            <ProgressPill completed={item.completed} total={item.total} />
          </View>
        </Card>
      );
    },
    [navigation],
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
          <Text style={styles.cardTitle} numberOfLines={2}>
            {continueLesson.title}
          </Text>
          <Text style={styles.cardSub} numberOfLines={2}>
            {continueLesson.description || "次のレッスンを始めましょう。"}
          </Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <PrimaryButton title="レッスンを開く" onPress={() => navigation.navigate("LessonLaunch", { lessonId: continueLesson.id })} />
          </View>
        </Card>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.h2}>ユニット</Text>
      </View>

      <FlatList
        data={units}
        keyExtractor={(u) => u.category}
        contentContainerStyle={{ paddingBottom: 64, gap: 12 }}
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: theme.spacing.md },
  h1: { ...theme.typography.h1, color: theme.colors.text },
  h2: { ...theme.typography.h2, color: theme.colors.text },
  subtle: { marginTop: 6, color: theme.colors.textMuted, fontWeight: "700" },
  linkBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: theme.radius.md, backgroundColor: "#f3f4f6", minHeight: 44, justifyContent: "center" },
  linkText: { fontWeight: "900", color: "#374151" },

  continueCard: { marginTop: theme.spacing.sm },
  cardEyebrow: { ...theme.typography.sub, color: theme.colors.textMuted },
  cardTitle: { marginTop: 6, fontSize: 18, fontWeight: "900", color: theme.colors.text, letterSpacing: 0.2 },
  cardSub: { marginTop: 8, color: theme.colors.textMuted, fontWeight: "700", lineHeight: 18 },

  sectionHeader: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm, flexDirection: "row", alignItems: "center" },
  unitCard: { padding: theme.spacing.md },
});


