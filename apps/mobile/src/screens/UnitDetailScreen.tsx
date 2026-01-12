import React, { useCallback, useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getRoadmapLessons, type RoadmapLesson } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Card, ListRow, ProgressPill, Screen } from "../ui/components";
import { theme } from "../ui/theme";

type Props = NativeStackScreenProps<RootStackParamList, "UnitDetail">;

function findUnlockUntilLessonId(all: RoadmapLesson[]) {
  const byHref = all.find((l) => (l.href || "").includes("/training/basics/pawn/tarefu"));
  if (byHref?.id) return byHref.id;
  const byTitle = all.find((l) => (l.title || "").includes("垂れ歩"));
  if (byTitle?.id) return byTitle.id;
  // fallback: keep at least the first lesson unlocked
  return all[0]?.id ?? "";
}

export function UnitDetailScreen({ navigation, route }: Props) {
  const { category } = route.params;
  const { progress } = useProgress();
  const completed = useMemo(() => new Set(progress.completedLessonIds), [progress.completedLessonIds]);

  const allLessonsSorted = useMemo(() => getRoadmapLessons().slice().sort((a, b) => a.index - b.index), []);
  const allLessonIds = useMemo(() => new Set(getRoadmapLessons().map((l) => l.id)), []);
  const UNLOCK_UNTIL_ID = useMemo(() => findUnlockUntilLessonId(allLessonsSorted), [allLessonsSorted]);
  const unlockUntilOrder = useMemo(() => {
    const t = allLessonsSorted.find((l) => l.id === UNLOCK_UNTIL_ID);
    return typeof t?.index === "number" ? t.index : 0;
  }, [UNLOCK_UNTIL_ID, allLessonsSorted]);

  const lessons = useMemo(() => {
    return getRoadmapLessons()
      .filter((l) => l.category === category)
      .slice()
      // Preserve original ordering (web LESSONS array order)
      .sort((a, b) => a.index - b.index);
  }, [category]);

  const unitProgress = useMemo(() => {
    const total = lessons.length;
    const done = lessons.reduce((acc, l) => acc + (completed.has(l.id) ? 1 : 0), 0);
    return { done, total };
  }, [completed, lessons]);

  const isUnlocked = useCallback(
    (lesson: RoadmapLesson, idx: number) => {
      // force-unlock until "tarefu" (inclusive)
      if (unlockUntilOrder && lesson.index <= unlockUntilOrder) return true;
      // always unlock the first lesson in the list
      if (idx === 0) return true;
      // completed is always playable
      if (completed.has(lesson.id)) return true;

      const prereq = Array.isArray(lesson.prerequisites) ? lesson.prerequisites : [];
      // ignore missing prereq IDs (prevents accidental full-lock)
      const relevant = prereq.filter((id) => allLessonIds.has(id));
      if (relevant.length === 0) return true;
      return relevant.every((id) => completed.has(id));
    },
    [allLessonIds, completed, unlockUntilOrder],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: RoadmapLesson; index: number }) => {
      const done = completed.has(item.id);
      const unlocked = isUnlocked(item, index);
      const disabled = !unlocked || !item.href;
      const leftIcon = !unlocked ? "🔒" : done ? "✓" : disabled ? "⏳" : "▶";
      const rightText = done ? "完了" : !unlocked ? "ロック" : disabled ? "準備中" : "";
      return (
        <Card style={styles.lessonCard}>
          <ListRow
            title={item.title}
            subtitle={item.description || undefined}
            leftIcon={leftIcon}
            rightText={rightText || undefined}
            disabled={disabled}
            onPress={() => navigation.navigate("LessonLaunch", { lessonId: item.id })}
          />
        </Card>
      );
    },
    [completed, isUnlocked, navigation],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1} numberOfLines={1}>
            {category}
          </Text>
          <Text style={styles.subtle}>レッスン一覧</Text>
        </View>
        <ProgressPill completed={unitProgress.done} total={unitProgress.total} />
      </View>
      <FlatList
        data={lessons}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingBottom: 64, gap: 12 }}
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: theme.spacing.md },
  h1: { ...theme.typography.h1, color: theme.colors.text },
  subtle: { marginTop: 6, color: theme.colors.textMuted, fontWeight: "700" },
  lessonCard: { padding: theme.spacing.md },
});


