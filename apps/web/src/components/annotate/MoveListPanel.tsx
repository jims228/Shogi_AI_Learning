"use client";

import React from "react";
import { getImpactDescriptor } from "@/lib/analysisUtils";
import styles from "./MoveListPanel.module.css";

type MoveListEntry = {
  ply: number;
  label: string;
  diff: number | null;
};

type MoveListPanelProps = {
  entries: MoveListEntry[];
  activePly: number;
  onSelectPly: (ply: number) => void;
};

const badgeClassMap = {
  good: styles.badgeGood,
  inaccuracy: styles.badgeInaccuracy,
  mistake: styles.badgeMistake,
  blunder: styles.badgeBlunder,
  neutral: styles.badgeNeutral,
  unknown: styles.badgeNeutral,
} as const;

export default function MoveListPanel({ entries, activePly, onSelectPly }: MoveListPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>棋譜リスト</div>
      <div className={styles.list}>
        {entries.length ? (
          entries.map((entry) => {
            const isActive = entry.ply === activePly;
            const descriptor = getImpactDescriptor(entry.diff);
            const badgeClass = badgeClassMap[descriptor.classification] ?? styles.badgeNeutral;
            return (
              <button
                key={entry.ply}
                type="button"
                onClick={() => onSelectPly(entry.ply)}
                className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
              >
                <span className={styles.ply}>{entry.ply}手目</span>
                <span className={styles.label}>{entry.label}</span>
                <span className={`${styles.badge} ${badgeClass}`}>{descriptor.diffLabel}</span>
              </button>
            );
          })
        ) : (
          <div className={styles.empty}>棋譜が読み込まれていません</div>
        )}
      </div>
    </div>
  );
}
