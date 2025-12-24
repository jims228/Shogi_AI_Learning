"use client";

import React from "react";

type Props = {
  mascot: React.ReactNode;
  explanation: React.ReactNode;
  board: React.ReactNode;
  actions?: React.ReactNode;
};

/**
 * Mobile-only lesson layout for WebView (Duolingo-ish):
 * - 1 screen (100dvh), no scrolling
 * - top-left: mascot + short explanation
 * - bottom: board maximized
 */
export function MobileLessonShell({ mascot, explanation, board, actions }: Props) {
  return (
    <div
      data-mobile-lesson-shell
      className="h-[100dvh] overflow-hidden flex flex-col text-amber-50"
      style={{
        background: "linear-gradient(180deg, #3a261c 0%, #2d1f16 55%, #241710 100%)",
      }}
    >
      <div className="shrink-0 px-3 pt-2">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-[210px] h-[210px] flex items-start justify-start">{mascot}</div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="max-h-[210px] overflow-auto pr-1">{explanation}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-1 pb-4 flex flex-col">
        {/* Raise the board a bit to avoid the bottom UI being cut off in WebView. */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center -mt-5">{board}</div>
        {/* Keep actions directly under the board, with extra bottom padding for tap safety. */}
        {actions ? <div className="shrink-0 px-2 pt-2 pb-2">{actions}</div> : null}
      </div>
    </div>
  );
}


