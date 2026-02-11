import React from "react";
import { StyleSheet, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { theme } from "../theme";
import { LESSON_SPACING } from "./lessonSpacing";

type Props = {
  nextLabel: string;
  onNext: () => void;
  disabled: boolean;
};

export function LessonFooter({ nextLabel, onNext, disabled }: Props) {
  return (
    <View style={styles.footer}>
      <PrimaryButton title={nextLabel} onPress={onNext} disabled={disabled} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: LESSON_SPACING.footerPaddingHorizontal,
    paddingTop: LESSON_SPACING.footerPaddingTop,
    paddingBottom: LESSON_SPACING.footerPaddingBottom,
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    minHeight: LESSON_SPACING.footerButtonMinHeight,
  },
});
