import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

export function ProgressPill({ completed, total }: { completed: number; total: number }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const isDone = total > 0 && completed >= total;
  const bg = isDone ? "#dcfce7" : "#ecfccb";
  const fg = isDone ? "#166534" : "#365314";
  const label = total ? `${completed}/${total} • ${pct}%` : "0%";
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  text: { fontWeight: "900", fontSize: 12, letterSpacing: 0.2 },
});

