import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { getApiBaseUrl, getWebBaseUrl } from "../lib/env";
import { useProgress } from "../state/progress";

export function SettingsScreen() {
  const { progress, reset } = useProgress();

  return (
    <View style={styles.root}>
      <Text style={styles.h}>環境</Text>
      <View style={styles.card}>
        <Text style={styles.k}>WEB_BASE_URL</Text>
        <Text style={styles.v}>{getWebBaseUrl()}</Text>
        <Text style={styles.k}>API_BASE_URL</Text>
        <Text style={styles.v}>{getApiBaseUrl()}</Text>
      </View>

      <Text style={styles.h}>進捗</Text>
      <View style={styles.card}>
        <Text style={styles.v}>完了: {progress.completedLessonIds.length} 件</Text>
        <Text style={styles.v}>最後: {progress.lastPlayedLessonId ?? "-"}</Text>
      </View>

      <Pressable
        style={styles.dangerBtn}
        onPress={() => {
          Alert.alert("進捗をリセットしますか？", "この操作は取り消せません。", [
            { text: "キャンセル", style: "cancel" },
            { text: "リセット", style: "destructive", onPress: reset },
          ]);
        }}
      >
        <Text style={styles.dangerText}>進捗をリセット</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", padding: 16, gap: 12 },
  h: { fontSize: 14, fontWeight: "900", color: "#111827", marginTop: 8 },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 16, padding: 12, backgroundColor: "#fff", gap: 6 },
  k: { fontSize: 12, fontWeight: "900", color: "#6b7280", marginTop: 8 },
  v: { fontSize: 13, fontWeight: "700", color: "#111827" },
  dangerBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: "#fee2e2", alignItems: "center" },
  dangerText: { fontWeight: "900", color: "#991b1b" },
});


