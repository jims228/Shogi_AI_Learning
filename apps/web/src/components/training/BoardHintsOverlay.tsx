"use client";

import React, { useId, useMemo, useEffect, useRef } from "react";

export type HintSquare = { file: number; rank: number };
export type HintArrow = { from: HintSquare; to: HintSquare };

type Props = {
  hintSquares?: HintSquare[];
  hintArrows?: HintArrow[];
  coordMode?: "shogi" | "ltr";
  className?: string;
  boardPxSize?: number;
  flipped?: boolean;
};

export default function BoardHintsOverlay({
  hintSquares = [],
  hintArrows = [],
  coordMode = "shogi",
  className,
  boardPxSize,
  flipped = false,
}: Props) {
  const rid = useId();
  const markerId = useMemo(() => `hintArrow-${rid.replace(/[:]/g, "")}`, [rid]);
  const hasAnything = hintSquares.length > 0 || hintArrows.length > 0;
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // removed verbose debug logging in production
    return;
  }, []);
  if (!hasAnything) return null;

  const toColRow = (sq: HintSquare) => {
    // screen: left=9, right=1, top=1, bottom=9
    if (coordMode === "shogi") {
      if (!flipped) {
        const col = 9 - sq.file; // 9..1 -> 0..8
        const row = sq.rank - 1; // 1..9 -> 0..8
        return { col, row };
      } else {
        // flipped 表示のときのマッピング
        const col = sq.file - 1;
        const row = 9 - sq.rank;
        return { col, row };
      }
    }
    // ltr mode (left-to-right file increases)
    const row = sq.rank - 1;
    const col = sq.file - 1;
    return { col, row };
  };

  const squareRect = (sq: HintSquare) => {
    const { col, row } = toColRow(sq);
    return { x: col, y: row, w: 1, h: 1 };
  };

  const squareCenter = (sq: HintSquare) => {
    const r = squareRect(sq);
    return { cx: r.x + 0.5, cy: r.y + 0.5 };
  };

  return (
    <div
      ref={wrapperRef}
      data-testid="board-hints-overlay"
      className={[
        "pointer-events-none absolute inset-0",
        className ?? "",
      ].join(" ")}
      style={boardPxSize ? { width: `${boardPxSize}px`, height: `${boardPxSize}px` } : undefined}
      aria-hidden="true"
    >
      <svg
        data-testid="board-hints-overlay-svg"
        viewBox="0 0 9 9"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <marker
            id={markerId}
            markerUnits="userSpaceOnUse"
            markerWidth="0.4"
            markerHeight="0.4"
            refX="0.36"
            refY="0.2"
            orient="auto"
            viewBox="0 0 0.4 0.4"
          >
            <path d="M0,0 L0.4,0.2 L0,0.4 z" fill="currentColor" />
          </marker>

          <style>{`
            @keyframes hintBlink {
              0%, 100% { opacity: .18; }
              50%      { opacity: .75; }
            }
            @keyframes hintDash {
              to { stroke-dashoffset: -2.0; }
            }
            .hintSquare {
              animation: hintBlink 1.1s ease-in-out infinite;
            }
            .hintArrow {
              animation: hintBlink 1.0s ease-in-out infinite, hintDash 1.2s linear infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .hintSquare, .hintArrow { animation: none; opacity: .5; }
            }
          `}</style>
        </defs>

        {hintSquares.map((sq, i) => {
          const r = squareRect(sq);
          return (
            <rect
              data-testid="hint-square"
              key={`sq-${i}-${sq.file}-${sq.rank}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={0.12}
              className="hintSquare"
              vectorEffect="non-scaling-stroke"
              fill="currentColor"
              opacity={0.25}
            />
          );
        })}

        {hintArrows.map((a, i) => {
          const s = squareCenter(a.from);
          const t = squareCenter(a.to);
          return (
            <line
              data-testid="hint-arrow"
              key={`ar-${i}-${a.from.file}-${a.from.rank}-${a.to.file}-${a.to.rank}`}
              x1={s.cx}
              y1={s.cy}
              x2={t.cx}
              y2={t.cy}
              className="hintArrow"
              stroke="currentColor"
              strokeWidth={0.14}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={0.95}
              strokeLinecap="round"
              strokeDasharray="0.5 0.4"
              markerEnd={`url(#${markerId})`}
              opacity={0.85}
            />
          );
        })}
      </svg>
    </div>
  );
}
