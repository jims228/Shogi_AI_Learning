"use client";

import React, { useId, useMemo, useEffect, useRef, useState } from "react";

export type HintSquare = { file: number; rank: number };
export type HintArrow = {
  to: HintSquare;
  from?: HintSquare;
  kind?: "move" | "drop";
  dir?: "up" | "down" | "left" | "right" | "hand";
  hand?: "sente" | "gote";
};

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
  const [handMeasureTick, setHandMeasureTick] = useState(0);

  const needsHand = useMemo(
    () => hintArrows.some(a => (a.dir === "hand") && (a.kind === "drop" || !a.from)),
    [hintArrows]
  );

  useEffect(() => {
    if (!needsHand) return;
    let n = 0;
    const id = window.setInterval(() => {
      setHandMeasureTick(t => t + 1);
      n++;
      if (n >= 12) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [needsHand]);

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

  const dropStart = (t: { cx: number; cy: number }, dir?: HintArrow["dir"]) => {
    // viewBox は 0..9。hand は「盤の下」から来るようにする（線は盤外から入ってくるのでOK）
    // flipped のときは上下逆になるので上側から
    if (dir === "hand") {
      return { cx: t.cx, cy: flipped ? -0.8 : 9.8 };
    }
    // 既存互換（近い位置から降ってくる）
    switch (dir) {
      case "up": return { cx: t.cx, cy: t.cy - 1.2 };
      case "down": return { cx: t.cx, cy: t.cy + 1.2 };
      case "left": return { cx: t.cx - 1.2, cy: t.cy };
      case "right": return { cx: t.cx + 1.2, cy: t.cy };
      default: return { cx: t.cx, cy: t.cy + 1.2 };
    }
  };

  return (
    <div
      ref={wrapperRef}
      data-testid="board-hints-overlay"
      className={[
        "pointer-events-none absolute inset-0",
        className ?? "",
      ].join(" ")}
      style={{
        ...(boardPxSize ? { width: `${boardPxSize}px`, height: `${boardPxSize}px` } : null as any),
        overflow: "visible",
      }}
      aria-hidden="true"
    >
      <svg
        data-testid="board-hints-overlay-svg"
        viewBox="0 0 9 9"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        overflow="visible"
      >
        <defs>
          <marker
            id={markerId}
            markerUnits="userSpaceOnUse"
            markerWidth="0.35"
            markerHeight="0.35"
            refX="1"
            refY="0.5"
            orient="auto"
            viewBox="0 0 1 1"
          >
            <path d="M0,0 L1,0.5 L0,1 z" fill="currentColor" />
          </marker>

          <style>{`
            @keyframes hintBlink {
              0%, 100% { opacity: .18; }
              50%      { opacity: .75; }
            }
            @keyframes hintDash {
              to { stroke-dashoffset: -2.0; }
            }
            /* 点滅を無効化。矢印のダッシュだけ残す場合は下行を有効化 */
            .hintArrow { animation: hintDash 1.2s linear infinite; }
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
              opacity={0.18}
            />
          );
        })}

        {hintArrows.map((a, i) => {
          const t = squareCenter(a.to);

          const handStartFromDom = () => {
            void handMeasureTick; // trigger re-eval when tick changes
            const wrap = wrapperRef.current;
            if (!wrap) return null;
            const wrapRect = wrap.getBoundingClientRect();
            const who = a.hand ?? "sente";
            const el = document.querySelector(`[data-testid="hand-piece-${who}-P"]`) as HTMLElement | null;
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const cxPx = r.left + r.width / 2;
            const cyPx = r.top + r.height / 2;
            const cx = ((cxPx - wrapRect.left) / wrapRect.width) * 9;
            const cy = ((cyPx - wrapRect.top) / wrapRect.height) * 9;
            return { cx, cy };
          };

          const dropStartFrom = () => {
            // prefer DOM-derived hand start when dir==='hand' and element exists
            if ((a.kind === "drop" || !a.from) && a.dir === "hand") {
              const hs = handStartFromDom();
              if (hs) return hs;
              return { cx: t.cx, cy: flipped ? -0.8 : 9.8 };
            }
            switch (a.dir) {
              case "up": return { cx: t.cx, cy: t.cy - 1.2 };
              case "down": return { cx: t.cx, cy: t.cy + 1.2 };
              case "left": return { cx: t.cx - 1.2, cy: t.cy };
              case "right": return { cx: t.cx + 1.2, cy: t.cy };
              default: return { cx: t.cx, cy: t.cy + 1.2 };
            }
          };

          const isDrop = a.kind === "drop" || !a.from;
          const s = a.from ? squareCenter(a.from) : dropStartFrom();

          if (!s) return null;
          if (Math.abs(s.cx - t.cx) < 1e-6 && Math.abs(s.cy - t.cy) < 1e-6) return null;

          const keyFrom = a.from ? `${a.from.file}-${a.from.rank}` : "drop";

          return (
            <line
              data-testid="hint-arrow"
              key={`ar-${i}-${keyFrom}-${a.to.file}-${a.to.rank}`}
              x1={s.cx}
              y1={s.cy}
              x2={t.cx}
              y2={t.cy}
              className="hintArrow"
              stroke="currentColor"
              strokeWidth={0.16}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={0.95}
              strokeLinecap="round"
              strokeDasharray="0.5 0.4"
              markerEnd={`url(#${markerId})`}
              opacity={0.95}
            />
          );
        })}
      </svg>
    </div>
  );
}
