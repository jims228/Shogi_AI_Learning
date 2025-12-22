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
};

export default function BoardHintsOverlay({
  hintSquares = [],
  hintArrows = [],
  coordMode = "shogi",
  className,
  boardPxSize,
}: Props) {
  const rid = useId();
  const markerId = useMemo(() => `hintArrow-${rid.replace(/[:]/g, "")}`, [rid]);
  const hasAnything = hintSquares.length > 0 || hintArrows.length > 0;
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = wrapperRef.current;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      const svg = el.querySelector('svg[viewBox="0 0 9 9"]');
      const rects = svg ? svg.querySelectorAll('rect.hintSquare') : [];
      const lines = svg ? svg.querySelectorAll('line.hintArrow') : [];
      const marker = svg ? svg.querySelector('marker') : null;
      const color = window.getComputedStyle(el).color;

      // Walk up ancestor chain and log bounding rects to help identify 0x0 parent
      const ancestors: Array<{ tag: string; className: string; rect: DOMRect | null }> = [];
      let p: Element | null = el;
      while (p) {
        try {
          const r = (p as Element).getBoundingClientRect ? (p as Element).getBoundingClientRect() : null;
          ancestors.push({ tag: p.tagName, className: (p as Element).className?.toString?.() ?? "", rect: r });
        } catch (e) {
          ancestors.push({ tag: p.tagName, className: (p as Element).className?.toString?.() ?? "", rect: null });
        }
        p = p.parentElement;
      }

      // eslint-disable-next-line no-console
      console.debug('[DEBUG-BoardHintsOverlay] mounted', { rect, svgExists: !!svg, rects: rects.length, lines: lines.length, marker: !!marker, color, ancestors });

      // warn if any ancestor has zero width/height
      const zeroAnc = ancestors.find((a) => a.rect && (a.rect.width <= 0 || a.rect.height <= 0));
      if (zeroAnc) {
        // eslint-disable-next-line no-console
        console.warn('[DEBUG-BoardHintsOverlay] found zero-sized ancestor', zeroAnc);
      }
    } catch (e) {
      // ignore
    }
  }, []);
  if (!hasAnything) return null;

  const toColRow = (sq: HintSquare) => {
    const row = sq.rank - 1; // rankは上が1
    const col = coordMode === "shogi" ? 9 - sq.file : sq.file - 1; // fileの向きだけ切替
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
            markerWidth="0.8"
            markerHeight="0.8"
            refX="0.7"
            refY="0.4"
            orient="auto"
          >
            <path d="M0,0 L0.8,0.4 L0,0.8 z" fill="currentColor" />
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
              strokeWidth={0.12}
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
