"use client";
import React from "react";

export default function XPBar({ value, max = 1000 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="w-48">
      <div className="text-xs mb-1">XP {value}/{max}</div>
      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-3 bg-amber-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
