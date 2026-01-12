import React from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { theme } from "../theme";

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      hitSlop={10}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brand,
    borderBottomWidth: 4,
    borderBottomColor: theme.colors.brandDark,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.button,
  },
  pressed: { transform: [{ translateY: 1 }], borderBottomWidth: 2 },
  disabled: { opacity: 0.55 },
  text: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.2 },
});

