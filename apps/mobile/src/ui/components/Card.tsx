import React from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { theme } from "../theme";

export function Card({
  children,
  style,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  disabled?: boolean;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.card, pressed && !disabled && styles.pressed, disabled && { opacity: 0.6 }, style]}
        hitSlop={8}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  pressed: { transform: [{ scale: 0.995 }], opacity: 0.95 },
});

