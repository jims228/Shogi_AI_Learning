"use client";

import React, { useMemo } from "react";
import styles from "./EvalGraph.module.css";

export type EvalPoint = {
  ply: number;
  cp: number | null;
};

type EvalGraphProps = {
  data: EvalPoint[];
  currentPly: number;
};

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 260;
const PADDING_X = 28;
const PADDING_Y = 24;

export default function EvalGraph({ data, currentPly }: EvalGraphProps) {
  const maxPly = data.length ? data[data.length - 1].ply : 0;
  const hasData = useMemo(() => data.some((point) => point.cp !== null), [data]);

  const { pathD, highlightPoint, zeroLineY, yTicks } = useMemo(() => {
    if (!data.length || !hasData) {
      return { pathD: "", highlightPoint: null, zeroLineY: VIEW_HEIGHT / 2, yTicks: [] as { value: number; y: number }[] };
    }

    const cpValues = data.map((d) => Math.abs(d.cp ?? 0));
    const maxAbs = Math.max(100, ...cpValues);
    const usableWidth = VIEW_WIDTH - PADDING_X * 2;
    const usableHeight = VIEW_HEIGHT - PADDING_Y * 2;

    const scaleX = (ply: number) => {
      if (maxPly === 0) return PADDING_X;
      return PADDING_X + (ply / maxPly) * usableWidth;
    };

    const scaleY = (cp: number) => PADDING_Y + (1 - (cp + maxAbs) / (maxAbs * 2)) * usableHeight;

    let d = "";
    data.forEach((point, index) => {
      if (point.cp === null) return;
      const x = scaleX(point.ply);
      const y = scaleY(point.cp);
      d += `${index === 0 ? "M" : "L"}${x},${y} `;
    });

    const current = data.find((p) => p.ply === currentPly && p.cp !== null);
    const highlight = current
      ? {
          x: scaleX(current.ply),
          y: scaleY(current.cp as number),
          cp: current.cp,
        }
      : null;

    const zeroLine = scaleY(0);
    const ticks = [-400, -200, 0, 200, 400];

    return {
      pathD: d.trim(),
      highlightPoint: highlight,
      zeroLineY: zeroLine,
      yTicks: ticks.map((t) => ({ value: t, y: scaleY(t) })),
    };
  }, [data, hasData, maxPly]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>評価値グラフ</div>
      {hasData ? (
        <div className={styles.graphWrapper}>
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className={styles.svg} role="img" aria-label="評価値グラフ">
            <rect
              x={PADDING_X}
              y={PADDING_Y}
              width={VIEW_WIDTH - PADDING_X * 2}
              height={VIEW_HEIGHT - PADDING_Y * 2}
              fill="url(#washiTexture)"
              className={styles.graphBackground}
            />
            <defs>
              <linearGradient id="evalLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#36507a" />
                <stop offset="100%" stopColor="#ab3f2b" />
              </linearGradient>
              <pattern id="washiTexture" width="6" height="6" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="#f9f3e5" />
                <circle cx="1" cy="1" r="0.35" fill="#e5dfcf" />
                <circle cx="4" cy="4" r="0.4" fill="#e5dfcf" />
              </pattern>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={PADDING_X}
                  x2={VIEW_WIDTH - PADDING_X}
                  y1={tick.y}
                  y2={tick.y}
                  className={styles.tickLine}
                />
                <text x={8} y={tick.y + 4} className={styles.tickLabel}>
                  {tick.value}
                </text>
              </g>
            ))}

            <line
              x1={PADDING_X}
              x2={VIEW_WIDTH - PADDING_X}
              y1={zeroLineY}
              y2={zeroLineY}
              className={styles.zeroLine}
            />

            {pathD && <path d={pathD} className={styles.path} stroke="url(#evalLine)" />}

            {highlightPoint && (
              <g className={styles.highlightGroup}>
                <line
                  x1={highlightPoint.x}
                  x2={highlightPoint.x}
                  y1={PADDING_Y}
                  y2={VIEW_HEIGHT - PADDING_Y}
                  className={styles.highlightLine}
                />
                <circle
                  cx={highlightPoint.x}
                  cy={highlightPoint.y}
                  r={6}
                  className={styles.highlightDot}
                />
                <text x={highlightPoint.x + 10} y={highlightPoint.y - 10} className={styles.highlightLabel}>
                  {highlightPoint.cp}cp
                </text>
              </g>
            )}
          </svg>
        </div>
      ) : (
        <div className={styles.empty}>解析データが揃うと評価値グラフが表示されます。</div>
      )}
    </div>
  );
}
