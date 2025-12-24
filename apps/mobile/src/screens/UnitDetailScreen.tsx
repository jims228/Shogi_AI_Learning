import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ROADMAP, type RoadmapLesson } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "UnitDetail">;

function isUnlocked(lesson: RoadmapLesson, completed: Set<string>) {
  const prereq = lesson.prerequisites || [];
  return prereq.every((id) => completed.has(id));
}

export function UnitDetailScreen({ navigation, route }: Props) {
  const { category } = route.params;
  const { progress } = useProgress();
  const completed = useMemo(() => new Set(progress.completedLessonIds), [progress.completedLessonIds]);

  const lessons = useMemo(() => {
    return ROADMAP.lessons
      .filter((l) => l.category === category)
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [category]);

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>{category}</Text>

      <FlatList
        data={lessons}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const done = completed.has(item.id);
          const unlocked = isUnlocked(item, completed);
          const disabled = !unlocked || !item.href;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.rowCard,
                disabled && { opacity: 0.5 },
                pressed && !disabled && { opacity: 0.9 },
              ]}
              disabled={disabled}
              onPress={() => navigation.navigate("LessonLaunch", { lessonId: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.description}
                </Text>
                {!unlocked ? <Text style={styles.locked}>ロック中（前提未達）</Text> : null}
              </View>
              <Text style={[styles.badge, done ? styles.badgeDone : styles.badgeTodo]}>{done ? "完了" : "未"}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 8 },
  h1: { fontSize: 16, fontWeight: "800", color: "#111827", paddingHorizontal: 16, paddingVertical: 8 },
  rowCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 14, fontWeight: "800", color: "#111827" },
  desc: { marginTop: 4, color: "#6b7280", fontWeight: "600" },
  locked: { marginTop: 6, color: "#b45309", fontWeight: "800" },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: "hidden", fontWeight: "800" },
  badgeDone: { backgroundColor: "#dcfce7", color: "#166534" },
  badgeTodo: { backgroundColor: "#fce7f3", color: "#9d174d" },
});


