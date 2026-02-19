"use client";

import React, { useEffect, useRef, useState } from "react";
import { ManRive } from "@/components/ManRive";

/**
 * Embeddable page that shows only the Rive おじいちゃん (man.riv).
 * Used by the mobile app (PawnLessonRemakeScreen) in a WebView for the character slot.
 * Native calls window.__avatarCorrect() when the user gets a correct answer to fire the surprise animation.
 *
 * globals.css sets body background to bg-ichimatsu.png (checker) + bamboo columns.
 * We override that here with a white background so the RN-side white circle wrap shows clean.
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
    <>
      <style>{`
        html, body {
          background: transparent !important;
          background-image: none !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        body::before, body::after {
          content: none !important;
          display: none !important;
        }
      `}</style>
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
    </>
  );
}
