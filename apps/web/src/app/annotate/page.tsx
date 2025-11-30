"use client";
import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import AnnotateView from "@/components/AnnotateView";

export default function AnnotatePage() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  return (
    <div className="flex flex-col h-full w-full bg-[#f9f3e5] text-slate-900">
      <header className="sticky top-0 left-0 right-0 z-50 border-b border-black/10 bg-[#f9f3e5]/95 shadow-sm shrink-0">
        <div className="mx-auto flex h-16 w-full max-w-[1300px] items-center gap-4 px-6 md:px-10">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-black/10 px-4 py-1 text-sm font-semibold text-[#2b1c10] hover:bg-black/5"
          >
            ＜ 戻る
          </button>
          <h1 className="text-lg font-semibold text-[#2b1c10]">復習タブ</h1>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="mx-auto w-full max-w-[1300px] h-full px-6 md:px-10 py-4">
          <div className="h-full rounded-3xl border border-black/10 bg-white/80 p-4 md:p-6 shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
            <div className="text-[#1f1308] shrink-0 mb-4">
              <p className="text-sm font-semibold text-[#b67a3c]">復習モード</p>
              <h2 className="mt-1 text-2xl font-bold text-[#120a04]">棋譜注釈</h2>
              <p className="mt-1 text-sm text-[#2b1c10]">盤面と解析を落ち着いた紙面の上で確認しましょう。</p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnnotateView />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
