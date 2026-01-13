import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";

import { theme } from "../theme";

export type SakuraTapBurstHandle = {
  spawn: (pageX: number, pageY: number) => void;
};

type Petal = {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  delayMs: number;
  durationMs: number;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export const SakuraTapBurst = forwardRef<SakuraTapBurstHandle, {}>(function SakuraTapBurst(_props, ref) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(Boolean(v)))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => setReduceMotion(Boolean(v)));
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const spawn = (pageX: number, pageY: number) => {
    if (reduceMotion) return;
    const count = Math.floor(rand(8, 13));
    const now = Date.now();
    const next: Petal[] = Array.from({ length: count }).map((_, i) => ({
      id: `${now}-${i}-${Math.floor(Math.random() * 1e6)}`,
      x: pageX,
      y: pageY,
      dx: rand(-44, 44),
      dy: rand(-120, -70),
      rot: rand(-30, 30),
      size: rand(10, 16),
      delayMs: rand(0, 90),
      durationMs: rand(700, 900),
    }));
    setPetals((prev) => [...prev, ...next]);
  };

  useImperativeHandle(ref, () => ({ spawn }), [reduceMotion]);

  const onPetalDone = (id: string) => {
    setPetals((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {petals.map((p) => (
        <PetalView key={p.id} petal={p} onDone={onPetalDone} />
      ))}
    </View>
  );
});

function PetalView({ petal, onDone }: { petal: Petal; onDone: (id: string) => void }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: petal.durationMs,
      delay: petal.delayMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) onDone(petal.id);
    });
    return () => {
      t.stopAnimation();
    };
  }, [onDone, petal.delayMs, petal.durationMs, petal.id, t]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, petal.dx] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, petal.dy] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: [`${petal.rot}deg`, `${petal.rot + rand(-140, 140)}deg`] });
  const opacity = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] });

  const base = useMemo(
    () => ({
      width: petal.size,
      height: petal.size * 0.78,
      borderRadius: petal.size,
    }),
    [petal.size],
  );

  return (
    <Animated.View
      style={[
        styles.petalWrap,
        {
          left: petal.x - petal.size / 2,
          top: petal.y - petal.size / 2,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }],
        },
      ]}
    >
      <View style={[styles.petal, base]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  petalWrap: { position: "absolute" },
  petal: {
    backgroundColor: theme.colors.brand,
    borderWidth: 1,
    borderColor: theme.colors.brandDark,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
});

