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
    <div className="min-h-screen w-full bg-[#f9f3e5] pb-20 text-slate-900">
      <header className="sticky top-0 left-0 right-0 z-50 border-b border-black/10 bg-[#f9f3e5]/95 shadow-sm">
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

      <main className="pt-16">
        <div className="mx-auto w-full max-w-[1300px] px-6 md:px-10">
          <div className="space-y-6 rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.08)] md:p-8">
            <div className="text-[#1f1308]">
              <p className="text-sm font-semibold text-[#b67a3c]">復習モード</p>
              <h2 className="mt-2 text-3xl font-bold text-[#120a04]">棋譜注釈</h2>
              <p className="mt-1 text-sm text-[#2b1c10]">盤面と解析を落ち着いた紙面の上で確認しましょう。</p>
            </div>
            <AnnotateView />
          </div>
        </div>
      </main>
    </div>
  );
}
