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
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-white text-slate-900">
      <div className="shrink-0 px-3 pt-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0">{mascot}</div>
          <div className="min-w-0 flex-1">{explanation}</div>
        </div>
        {actions ? <div className="mt-2">{actions}</div> : null}
      </div>

      <div className="flex-1 min-h-0 px-2 pb-3">
        <div className="w-full h-full min-h-0 flex items-end justify-center">{board}</div>
      </div>
    </div>
  );
}


