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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between rounded-2xl bg-white/85 border border-black/5 p-4 md:p-5 gap-4 text-[#1f1308]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("analysis")}
            className={`px-4 py-2 rounded-2xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "analysis" ? "bg-amber-200 text-[#3a2b17] shadow" : "bg-white text-[#2b1c10] hover:bg-amber-50"}`}
          >
            <span className="text-[#b67a3c]">☗</span>
            検討モード
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("review")}
            className={`px-4 py-2 rounded-2xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "review" ? "bg-emerald-100 text-[#1b4332] shadow" : "bg-white text-[#2b1c10] hover:bg-emerald-50"}`}
          >
            <span role="img" aria-label="review">📚</span>
            復習
          </button>
        </div>
        <div className="text-sm text-[#2b1c10]">
          {activeTab === "analysis"
            ? "矢印ボタンで手数を移動すると、その局面を自動解析します。"
            : "棋譜を再生して重要な局面を振り返りましょう。"}
        </div>
      </div>

      {activeTab === "analysis" ? (
        <AnalysisTab usi={usi} setUsi={setUsi} orientationMode={orientationMode} />
      ) : (
        <div className="rounded-2xl bg-white/90 border border-black/5 p-4 md:p-6 shadow-sm">
          <ReviewTab usi={usi} orientationMode={orientationMode} />
        </div>
      )}
    </div>
  );
}
