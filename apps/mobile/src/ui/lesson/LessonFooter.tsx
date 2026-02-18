import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { theme } from "../theme";
import { LESSON_SPACING } from "./lessonSpacing";

/** footer の高さ概算: paddingTop + buttonMinHeight + paddingBottom + border */
export const LESSON_FOOTER_HEIGHT =
  LESSON_SPACING.footerPaddingTop +
  LESSON_SPACING.footerButtonMinHeight +
  LESSON_SPACING.footerPaddingBottom +
  1;

const SLIDE_DISTANCE = LESSON_FOOTER_HEIGHT + 20;

type Props = {
  nextLabel: string;
  onNext: () => void;
  disabled: boolean;
};

export function LessonFooter({ nextLabel, onNext, disabled }: Props) {
  const slideAnim = useRef(new Animated.Value(disabled ? SLIDE_DISTANCE : 0)).current;

  useEffect(() => {
    if (!disabled) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(SLIDE_DISTANCE);
    }
  }, [disabled, slideAnim]);

  return (
    <Animated.View
      style={[styles.footer, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.inner}>
        <PrimaryButton
          title={nextLabel}
          onPress={onNext}
          disabled={disabled}
          style={styles.button}
          buttonStyle={styles.nextBtn}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  footer: {
    // position: absolute でレイアウトフローから切り離す → 上のコンテンツが押されない
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  inner: {
    paddingHorizontal: LESSON_SPACING.footerPaddingHorizontal,
    paddingTop: LESSON_SPACING.footerPaddingTop,
    paddingBottom: LESSON_SPACING.footerPaddingBottom,
  },
  button: {
    minHeight: LESSON_SPACING.footerButtonMinHeight,
  },
  nextBtn: {
    backgroundColor: "#6d4c41",
    borderBottomColor: "#3e2723",
  },
});
