import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { LESSON_SPACING } from "./lessonSpacing";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Wrapper for the lesson board (WebView or native board).
 * Keeps consistent padding and min height for Android.
 */
export function BoardArea({ children, style }: Props) {
  return <View style={[styles.area, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  area: {
    paddingHorizontal: LESSON_SPACING.headerPaddingHorizontal,
    paddingVertical: LESSON_SPACING.sectionGap,
    minHeight: 360,
    flex: 1,
  },
});
