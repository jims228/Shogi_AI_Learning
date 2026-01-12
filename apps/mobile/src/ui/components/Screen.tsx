import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { theme } from "../theme";

export function Screen({
  children,
  style,
  contentStyle,
  edges = ["top", "bottom"],
  pad = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: Edge[];
  pad?: boolean;
}) {
  return (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      <View style={[styles.content, pad && styles.padded, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1 },
  padded: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg },
});

