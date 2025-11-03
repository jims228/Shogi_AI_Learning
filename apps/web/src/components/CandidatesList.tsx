import React from "react";
import type { PVItem } from "@/lib/api";

export default function CandidatesList({ items }: { items: PVItem[] | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border p-3 text-sm">
      <div className="font-semibold mb-2">Candidates</div>
      <ul className="space-y-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center justify-between">
            <div className="truncate">
              <span className="mr-2">#{i+1}</span>
              <span className="mr-2">{c.move}</span>
              {typeof c.score_mate === "number" ? (
                <span>mate {c.score_mate}</span>
              ) : (
                <span>cp {c.score_cp ?? "-"}</span>
              )}
            </div>
            <span className="opacity-70">d{c.depth ?? "-"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
