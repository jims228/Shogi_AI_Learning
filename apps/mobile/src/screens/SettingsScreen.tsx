import React from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useProgress } from "../state/progress";
import { useSettings } from "../state/settings";

export function SettingsScreen() {
  const { progress, reset } = useProgress();
  const { settings, setWebBaseUrl, setApiBaseUrl, resetToDefaults, getSuggestedWebBaseUrlFromExpoHost } = useSettings();

  return (
    <View style={styles.root}>
      <Text style={styles.h}>環境</Text>
      <View style={styles.card}>
        <Text style={styles.k}>WEB_BASE_URL</Text>
        <TextInput
          value={settings.webBaseUrl}
          onChangeText={setWebBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://10.0.2.2:3000"
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable style={styles.presetBtn} onPress={() => setWebBaseUrl("http://127.0.0.1:3000")}>
            <Text style={styles.presetText}>USB (127.0.0.1)</Text>
          </Pressable>
          <Pressable style={styles.presetBtn} onPress={() => setWebBaseUrl("http://10.0.2.2:3000")}>
            <Text style={styles.presetText}>Android Emulator (10.0.2.2)</Text>
          </Pressable>
          <Pressable style={styles.presetBtn} onPress={() => setWebBaseUrl("http://localhost:3000")}>
            <Text style={styles.presetText}>localhost</Text>
          </Pressable>
          <Pressable
            style={styles.presetBtn}
            onPress={() => {
              const v = getSuggestedWebBaseUrlFromExpoHost();
              if (v) setWebBaseUrl(v);
            }}
          >
            <Text style={styles.presetText}>LAN推定</Text>
          </Pressable>
        </View>

        <Text style={styles.k}>API_BASE_URL</Text>
        <TextInput
          value={settings.apiBaseUrl}
          onChangeText={setApiBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://localhost:8787"
          style={styles.input}
        />

        <Pressable style={styles.subtleBtn} onPress={resetToDefaults}>
          <Text style={styles.subtleText}>環境をデフォルトに戻す</Text>
        </Pressable>
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
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontWeight: "700",
    color: "#111827",
  },
  row: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  presetBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: "#f3f4f6" },
  presetText: { fontWeight: "800", color: "#374151" },
  subtleBtn: { marginTop: 8, paddingVertical: 10, borderRadius: 12, backgroundColor: "#eef2ff", alignItems: "center" },
  subtleText: { fontWeight: "900", color: "#3730a3" },
  dangerBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: "#fee2e2", alignItems: "center" },
  dangerText: { fontWeight: "900", color: "#991b1b" },
});


