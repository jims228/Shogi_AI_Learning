"use client";

import React, { useEffect, useRef, useState } from "react";
import { ManRive } from "@/components/ManRive";

/**
 * Embeddable page that shows only the Rive おじいちゃん (man.riv).
 * Used by the mobile app (PawnLessonRemakeScreen) in a WebView for the character slot.
 * Native calls window.__avatarCorrect() when the user gets a correct answer to fire the surprise animation.
 */
export default function RiveAvatarPage() {
  const [correctSignal, setCorrectSignal] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    (window as unknown as { __avatarCorrect?: () => void }).__avatarCorrect = () => {
      if (mounted.current) setCorrectSignal((s) => s + 1);
    };
    return () => {
      delete (window as unknown as { __avatarCorrect?: () => void }).__avatarCorrect;
      mounted.current = false;
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 210,
        minWidth: 210,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      }}
      aria-label="Rive character"
    >
      <ManRive correctSignal={correctSignal} style={{ width: 210, height: 210 }} />
    </div>
  );
}
