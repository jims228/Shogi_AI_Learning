import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import { LESSON_SPACING, LESSON_COLORS } from "./lessonSpacing";

type Props = {
  progress: number;
  onClose?: () => void;
};

export function LessonHeader({ progress, onClose }: Props) {
  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    // Try expo-router first, then react-navigation
    try {
      const w = global as any;
      if (w.router?.back) {
        w.router.back();
        return;
      }
    } catch {
      // ignore
    }
    try {
      const w = global as any;
      if (w.__navigation?.goBack) {
        w.__navigation.goBack();
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleClose}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="閉じる"
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <View style={styles.progressWrap}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LESSON_SPACING.headerPaddingHorizontal,
    paddingVertical: LESSON_SPACING.headerPaddingVertical,
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnPressed: { opacity: 0.7 },
  closeText: {
    fontSize: 24,
    fontWeight: "300",
    color: theme.colors.text,
    lineHeight: 28,
    marginTop: -2,
  },
  progressWrap: {
    flex: 1,
    height: LESSON_SPACING.progressBarHeight,
    borderRadius: LESSON_SPACING.progressBarRadius,
    overflow: "hidden",
    backgroundColor: LESSON_COLORS.progressBg,
  },
  progressBg: {
    flex: 1,
    borderRadius: LESSON_SPACING.progressBarRadius,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: LESSON_SPACING.progressBarRadius,
    backgroundColor: LESSON_COLORS.progressFill,
  },
});
