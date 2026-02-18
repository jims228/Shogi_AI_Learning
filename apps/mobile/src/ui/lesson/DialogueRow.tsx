import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { theme } from "../theme";
import { LESSON_SPACING, LESSON_COLORS } from "./lessonSpacing";

type Props = {
  message: string;
  characterSlot: React.ReactNode;
  /** Character slot width; use 210 to match MobileLessonShell (ManRive). Default 88. */
  characterWidth?: number;
  style?: ViewStyle;
  /** Extra style applied to the speech bubble wrapper only. */
  bubbleStyle?: ViewStyle;
};

/**
 * Row: left = character (e.g. おじいちゃん), right = speech bubble with tail.
 * Matches web MobileLessonShell: mascot 210x210 + explanation with flex-1 and wrapping.
 */
export function DialogueRow({ message, characterSlot, characterWidth = 88, style, bubbleStyle }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.character, { width: characterWidth }]}>{characterSlot}</View>
      <View style={[styles.bubbleWrap, bubbleStyle]}>
        <View style={styles.bubble}>
          <Text style={styles.message}>{message}</Text>
        </View>
        <View style={styles.tail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 0,
    paddingRight: LESSON_SPACING.headerPaddingHorizontal,
    gap: LESSON_SPACING.sectionGap,
    marginBottom: LESSON_SPACING.sectionGap,
    overflow: "visible",
  },
  character: {
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    overflow: "visible",
  },
  bubbleWrap: {
    flex: 1,
    position: "relative",
    minHeight: 44,
  },
  bubble: {
    backgroundColor: LESSON_COLORS.dialogueBg,
    borderWidth: 1,
    borderColor: LESSON_COLORS.dialogueBorder,
    borderRadius: 16,
    padding: LESSON_SPACING.dialoguePadding,
    paddingLeft: LESSON_SPACING.dialoguePadding + 4,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 20,
  },
  // Tail pointing left toward the character (rotated square)
  tail: {
    position: "absolute",
    left: -6,
    bottom: 14,
    width: LESSON_SPACING.dialogueTailSize,
    height: LESSON_SPACING.dialogueTailSize,
    backgroundColor: LESSON_COLORS.dialogueBg,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: LESSON_COLORS.dialogueBorder,
    transform: [{ rotate: "-45deg" }],
  },
});
