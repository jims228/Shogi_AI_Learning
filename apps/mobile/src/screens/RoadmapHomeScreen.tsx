import React, { memo, useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getRoadmapLessons } from "../data/roadmap";
import { useProgress } from "../state/progress";
import type { RootStackParamList } from "../navigation/RootNavigator";

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

  const units = useMemo<UnitRow[]>(() => {
    const lessons = getRoadmapLessons();
    const byCat = new Map<string, { total: number; completed: number; firstIndex: number }>();
    for (const l of lessons) {
      const cat = l.category || "unknown";
      const curr = byCat.get(cat) ?? { total: 0, completed: 0, firstIndex: l.index ?? 999999 };
      curr.total += 1;
      if (progress.completedLessonIds.includes(l.id)) curr.completed += 1;
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
  }, [progress.completedLessonIds]);

  const renderItem = useCallback(
    ({ item, index }: { item: UnitRow; index: number }) => {
      const pct = item.total ? Math.round((item.completed / item.total) * 100) : 0;
      const offsets = [0, 18, -14, 22, -18, 10, 0, -10, 16, -6, 12, -20];
      const sideOffset = offsets[index % offsets.length] ?? 0;
      return (
        <UnitNode
          title={item.title}
          pct={pct}
          sideOffset={sideOffset}
          onPress={() => navigation.navigate("UnitDetail", { category: item.category })}
        />
      );
    },
    [navigation],
  );

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
        contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: 124, offset: 124 * index, index })}
      />
    </View>
  );
}

const UnitNode = memo(function UnitNode({
  title,
  pct,
  sideOffset,
  onPress,
}: {
  title: string;
  pct: number;
  sideOffset: number;
  onPress: () => void;
}) {
  const fill = pct >= 100 ? "#22c55e" : "#58cc02";
  const ring = pct >= 100 ? "#16a34a" : "#15803d";
  const icon = pct >= 100 ? "✓" : "★";
  return (
    <View style={styles.unitRow}>
      <View style={styles.pathLine} />
      <View style={[styles.unitWrap, { transform: [{ translateX: sideOffset }] }]}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.unitCircle, { backgroundColor: fill, borderColor: ring }, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.unitIcon}>{icon}</Text>
        </Pressable>
        <Pressable onPress={onPress} style={styles.unitPill}>
          <Text style={styles.unitText} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 22, fontWeight: "800", flex: 1, color: "#1f2937" },
  linkBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "#f3f4f6" },
  linkText: { fontWeight: "700", color: "#374151" },
  subtle: { marginTop: 6, color: "#6b7280", fontWeight: "600" },

  unitRow: { alignItems: "center", justifyContent: "center", height: 124 },
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
  unitWrap: { alignItems: "center", justifyContent: "center", gap: 10 },
  unitCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  unitIcon: { fontSize: 22, fontWeight: "900", color: "#111827" },
  unitPill: {
    backgroundColor: "#58cc02",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unitText: { color: "#fff", fontWeight: "900", letterSpacing: 0.2, maxWidth: 260 },
});


