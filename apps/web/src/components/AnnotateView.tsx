"use client";

import React, { useState } from "react";
import { useAnnotate } from "@/lib/annotateHook";
import type { OrientationMode } from "@/components/PieceSprite";
import ReviewTab from "@/components/annotate/ReviewTab";
import AnalysisTab from "@/components/annotate/AnalysisTab";

// 棋神アナリティクス風レイアウト
// タブで「検討モード」と「復習」を切り替える

export default function AnnotateView() {
  const { usi, setUsi } = useAnnotate();
  const [activeTab, setActiveTab] = useState<"analysis" | "review">("analysis");
  const orientationMode: OrientationMode = "sprite";

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4 p-4 max-w-[1600px] mx-auto">
      {/* Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between bg-shogi-panel p-3 rounded-xl border border-white/10 gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("analysis")}
            className={`px-4 py-2 rounded-2xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "analysis" ? "bg-white/15 text-white shadow-lg shadow-black/20" : "text-slate-400 hover:text-white"}`}
          >
            <span className="text-shogi-gold">☗</span>
            検討モード
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("review")}
            className={`px-4 py-2 rounded-2xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "review" ? "bg-white/15 text-white shadow-lg shadow-black/20" : "text-slate-400 hover:text-white"}`}
          >
            <span role="img" aria-label="review">📚</span>
            復習
          </button>
        </div>
        <div className="text-sm text-slate-400">
          {activeTab === "analysis"
            ? "矢印ボタンで手数を移動すると、その局面を自動解析します。"
            : "棋譜を再生して重要な局面を振り返りましょう。"}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "analysis" ? (
          <AnalysisTab usi={usi} setUsi={setUsi} orientationMode={orientationMode} />
        ) : (
          <div className="flex-1 w-full bg-shogi-panel rounded-2xl border border-white/10 p-4 overflow-y-auto h-full">
            <ReviewTab usi={usi} orientationMode={orientationMode} />
          </div>
        )}
      </div>
    </div>
  );
}
