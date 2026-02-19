import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import { LESSON_SPACING, LESSON_COLORS } from "./lessonSpacing";

const HEART_IMG = require("../../../assets/heart.png");
const MAX_LIVES = 5;

type Props = {
  progress: number;
  lives?: number;
  onClose?: () => void;
};

export function LessonHeader({ progress, lives = MAX_LIVES, onClose }: Props) {
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

      {/* ライフ表示 */}
      <View style={styles.livesWrap}>
        <Image source={HEART_IMG} style={styles.heartImg} resizeMode="contain" />
        <Text style={styles.livesText}>{Math.max(0, lives)}</Text>
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
    flex: 0,
    width: "65%",
    height: LESSON_SPACING.progressBarHeight,
    borderRadius: LESSON_SPACING.progressBarRadius,
    overflow: "hidden",
    backgroundColor: LESSON_COLORS.progressBg,
    alignSelf: "center",
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
  livesWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  heartImg: {
    width: 37,
    height: 37,
  },
  livesText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#e53935",
  },
});
