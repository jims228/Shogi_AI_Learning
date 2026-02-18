import React from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { theme } from "../theme";

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
  buttonStyle,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  buttonStyle?: ViewStyle;
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
        buttonStyle,
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
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand,
    borderBottomWidth: 4,
    borderBottomColor: theme.colors.brandDark,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.button,
  },
  pressed: { transform: [{ translateY: 1 }], borderBottomWidth: 2 },
  disabled: { opacity: 0.55 },
  text: { color: "#fff", fontWeight: "900", fontSize: 17, letterSpacing: 0.25 },
});

