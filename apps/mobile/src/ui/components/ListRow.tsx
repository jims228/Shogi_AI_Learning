import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

export function ListRow({
  title,
  subtitle,
  leftIcon,
  rightText,
  onPress,
  disabled,
}: {
  title: string;
  subtitle?: string;
  leftIcon?: string;
  rightText?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.left}>
        {leftIcon ? (
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{leftIcon}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {rightText ? (
          <Text style={styles.rightText} numberOfLines={1}>
            {rightText}
          </Text>
        ) : null}
        <Text style={styles.chev}>›</Text>
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && !disabled && { opacity: 0.92 }, disabled && { opacity: 0.55 }]}
      hitSlop={8}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: theme.radius.lg },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  left: { width: 40, alignItems: "center", justifyContent: "center" },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontWeight: "900", color: theme.colors.text, fontSize: 16 },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "900", color: theme.colors.text },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "700", color: theme.colors.textMuted },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  rightText: { fontSize: 12, fontWeight: "900", color: theme.colors.textMuted },
  chev: { fontSize: 26, lineHeight: 26, fontWeight: "900", color: "#9ca3af" },
});

