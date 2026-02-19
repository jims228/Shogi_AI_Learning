import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { LESSON_SPACING } from "./lessonSpacing";

const SUCCESS_MSG_HEIGHT = 32;

/** footer の高さ概算: successMsg + paddingTop + buttonMinHeight + paddingBottom + border */
export const LESSON_FOOTER_HEIGHT =
  SUCCESS_MSG_HEIGHT +
  LESSON_SPACING.footerPaddingTop +
  LESSON_SPACING.footerButtonMinHeight +
  LESSON_SPACING.footerPaddingBottom +
  1;

const SLIDE_DISTANCE = LESSON_FOOTER_HEIGHT + 80;

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
      <View style={styles.successRow}>
        <Text style={styles.successText}>正解！やったね！</Text>
      </View>
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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFE0C0",
    borderTopWidth: 1,
    borderTopColor: "#F0C090",
  },
  successRow: {
    height: SUCCESS_MSG_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: LESSON_SPACING.footerPaddingHorizontal,
    paddingBottom: 4,
  },
  successIcon: {
    fontSize: 22,
  },
  successText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#5B2908",
    letterSpacing: 0.3,
  },
  inner: {
    paddingHorizontal: LESSON_SPACING.footerPaddingHorizontal,
    paddingTop: 0,
    paddingBottom: LESSON_SPACING.footerPaddingBottom,
  },
  button: {
    minHeight: LESSON_SPACING.footerButtonMinHeight,
  },
  nextBtn: {
    backgroundColor: "#F07828",
    borderBottomColor: "#b85510",
  },
});
