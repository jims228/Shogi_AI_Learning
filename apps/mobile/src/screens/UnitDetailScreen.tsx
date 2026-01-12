import React, { memo, useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getRoadmapLessons, type RoadmapLesson } from "../data/roadmap";
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
      <View style={styles.unitHeaderWrap}>
        <View style={styles.unitHeaderPill}>
          <Text style={styles.unitHeaderText} numberOfLines={1}>
            {category}
          </Text>
        </View>
      </View>

      <FlatList
        data={lessons}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingBottom: 56, paddingTop: 12 }}
        renderItem={renderItem}
        // Rough but stable layout (reduces VirtualizedList warnings).
        getItemLayout={(_, index) => ({ length: 120, offset: 120 * index, index })}
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
  const offsets = [0, 18, -14, 22, -18, 10, 0, -10, 16, -6, 12, -20];
  const sideOffset = offsets[index % offsets.length] ?? 0;

  const fill = locked ? "#e5e7eb" : done ? "#22c55e" : "#58cc02";
  const ring = locked ? "#cbd5e1" : done ? "#16a34a" : "#15803d";
  const icon = locked ? "🔒" : done ? "✓" : disabled ? "⏳" : "▶";
  const ringW = done ? 6 : 3;

  return (
    <View style={styles.nodeRow}>
      {/* Path */}
      <View style={styles.pathLine} />

      <View style={[styles.nodeWrap, { transform: [{ translateX: sideOffset }] }]}>
        <Pressable
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.nodeButton,
            { backgroundColor: fill, borderColor: ring, borderWidth: ringW },
            disabled && { opacity: 0.55 },
            pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.nodeIcon}>{icon}</Text>
        </Pressable>
        <Text style={styles.nodeTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },

  unitHeaderWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  unitHeaderPill: {
    alignSelf: "flex-start",
    backgroundColor: "#58cc02",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unitHeaderText: { color: "#ffffff", fontWeight: "900", letterSpacing: 0.2 },

  nodeRow: { alignItems: "center", justifyContent: "center", height: 120 },
  pathLine: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 6,
    marginLeft: -3,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    opacity: 0.55,
  },
  nodeWrap: { alignItems: "center", justifyContent: "center" },
  nodeButton: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  nodeIcon: { fontSize: 22, fontWeight: "900", color: "#111827" },
  nodeTitle: { marginTop: 6, fontSize: 12, fontWeight: "900", color: "#111827", maxWidth: 280 },
});


