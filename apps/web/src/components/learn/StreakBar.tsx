"use client";
import React from "react";

export default function StreakBar({ value }: { value: number }) {
  return (
    <div className={`flex items-center gap-2 ${value > 0 ? 'animate-pulse' : ''}`}>
      <span className="text-amber-500 text-lg">🔥</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
