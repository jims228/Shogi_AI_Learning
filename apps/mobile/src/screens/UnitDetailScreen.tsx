import React, { memo, useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ROADMAP, type RoadmapLesson } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";

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

  const allLessonsSorted = useMemo(() => ROADMAP.lessons.slice().sort((a, b) => a.order - b.order), []);
  const allLessonIds = useMemo(() => new Set(ROADMAP.lessons.map((l) => l.id)), []);
  const UNLOCK_UNTIL_ID = useMemo(() => findUnlockUntilLessonId(allLessonsSorted), [allLessonsSorted]);
  const unlockUntilOrder = useMemo(() => {
    const t = allLessonsSorted.find((l) => l.id === UNLOCK_UNTIL_ID);
    return typeof t?.order === "number" ? t.order : 0;
  }, [UNLOCK_UNTIL_ID, allLessonsSorted]);

  const lessons = useMemo(() => {
    return ROADMAP.lessons
      .filter((l) => l.category === category)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [category]);

  const isUnlocked = useCallback(
    (lesson: RoadmapLesson, idx: number) => {
      // force-unlock until "tarefu" (inclusive)
      if (unlockUntilOrder && lesson.order <= unlockUntilOrder) return true;
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
      return (
        <LessonNode
          title={item.title}
          index={index}
          done={done}
          locked={!unlocked}
          disabled={disabled}
          onPress={() => navigation.navigate("LessonLaunch", { lessonId: item.id })}
        />
      );
    },
    [completed, isUnlocked, navigation],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>{category}</Text>

      <FlatList
        data={lessons}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        renderItem={renderItem}
      />
    </View>
  );
}

const LessonNode = memo(function LessonNode({
  title,
  index,
  done,
  locked,
  disabled,
  onPress,
}: {
  title: string;
  index: number;
  done: boolean;
  locked: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const sideOffset = index % 2 === 0 ? 28 : -28;
  const fill = locked ? "#e5e7eb" : done ? "#22c55e" : "#f472b6";
  const text = locked ? "🔒" : done ? "✓" : "▶";

  return (
    <View style={[styles.nodeRow, { paddingLeft: Math.max(0, sideOffset), paddingRight: Math.max(0, -sideOffset) }]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.nodeButton,
          { backgroundColor: fill },
          disabled && { opacity: 0.5 },
          pressed && !disabled && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.nodeIcon}>{text}</Text>
      </Pressable>
      <Text style={styles.nodeTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 8 },
  h1: { fontSize: 16, fontWeight: "900", color: "#111827", paddingHorizontal: 16, paddingVertical: 8 },
  nodeRow: { alignItems: "center", justifyContent: "center", marginVertical: 10, gap: 8 },
  nodeButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#11182710",
  },
  nodeIcon: { fontSize: 22, fontWeight: "900", color: "#111827" },
  nodeTitle: { marginTop: 2, fontSize: 12, fontWeight: "800", color: "#111827", maxWidth: 280 },
});


