"use client";
import React from "react";

export default function HeartsBadge({ value, max = 5 }: { value: number; max?: number }) {
  const hearts: React.ReactNode[] = [];
  for (let i = 0; i < max; i++) {
    const filled = i < value;
    hearts.push(
      <span key={i} className={filled ? 'text-rose-500' : 'text-gray-300'} aria-hidden>
        ♥
      </span>
    );
  }
  return <div className="text-lg">{hearts}</div>;
}
