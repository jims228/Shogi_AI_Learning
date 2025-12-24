import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ROADMAP } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "RoadmapHome">;

type UnitRow = {
  category: string;
  title: string;
  total: number;
  completed: number;
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

  const units = useMemo<UnitRow[]>(() => {
    const byCat = new Map<string, { total: number; completed: number }>();
    for (const l of ROADMAP.lessons) {
      const cat = l.category || "unknown";
      const curr = byCat.get(cat) ?? { total: 0, completed: 0 };
      curr.total += 1;
      if (progress.completedLessonIds.includes(l.id)) curr.completed += 1;
      byCat.set(cat, curr);
    }
    return Array.from(byCat.entries())
      .map(([category, v]) => ({
        category,
        title: categoryTitle(category),
        total: v.total,
        completed: v.completed,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "ja"));
  }, [progress.completedLessonIds]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.h1}>ロードマップ</Text>
        <Pressable onPress={() => navigation.navigate("Settings")} style={styles.linkBtn}>
          <Text style={styles.linkText}>設定</Text>
        </Pressable>
      </View>

      {!isLoaded ? <Text style={styles.subtle}>読み込み中...</Text> : null}

      <FlatList
        data={units}
        keyExtractor={(u) => u.category}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const pct = item.total ? Math.round((item.completed / item.total) * 100) : 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => navigation.navigate("UnitDetail", { category: item.category })}
            >
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.pct}>{pct}%</Text>
              </View>
              <Text style={styles.subtle}>
                {item.completed}/{item.total} 完了
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 22, fontWeight: "800", flex: 1, color: "#1f2937" },
  linkBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "#f3f4f6" },
  linkText: { fontWeight: "700", color: "#374151" },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  row: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827", flex: 1 },
  pct: { fontSize: 14, fontWeight: "800", color: "#db2777" },
  subtle: { marginTop: 6, color: "#6b7280", fontWeight: "600" },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "#f3f4f6", marginTop: 10, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: "#f472b6" },
});


