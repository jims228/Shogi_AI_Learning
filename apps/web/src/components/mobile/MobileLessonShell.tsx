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
      data-mobile="1"
      className="fixed inset-0 h-[100dvh] overflow-hidden flex flex-col bg-white text-slate-900"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 4px)" }}
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
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">{board}</div>
        {/* CTA area: pinned with safe area padding for consistent reachability (Duolingo-ish). */}
        {actions ? (
          <div
            className="shrink-0 px-2 pt-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}


