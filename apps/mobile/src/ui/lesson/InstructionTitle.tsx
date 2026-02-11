import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import { LESSON_SPACING } from "./lessonSpacing";

type Props = {
  text?: string;
};

const DEFAULT_INSTRUCTION = "パズルを解いてください";

export function InstructionTitle({ text = DEFAULT_INSTRUCTION }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: LESSON_SPACING.headerPaddingHorizontal,
    paddingVertical: LESSON_SPACING.instructionPaddingVertical,
  },
  text: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
});
