"use client";
import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AnnotateView from "@/components/AnnotateView";

export default function AnnotatePage() {
  return (
    <div className="min-h-screen pb-20 bg-transparent text-slate-900">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f9f3e5]/95 border-b border-black/10 shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1300px] items-center gap-4 px-6 md:px-10">
          <Link href="/" className="rounded-full p-2 text-[#555] transition-colors hover:bg-black/5">
            <ArrowLeft className="h-5 w-5 text-[#555]" />
          </Link>
          <h1 className="text-xl font-bold text-[#2b1c10]">棋譜注釈</h1>
        </div>
      </header>

      <main className="pt-24">
        <div className="mx-auto w-full max-w-[1300px] px-6 md:px-10">
          <div className="space-y-6 rounded-3xl border border-black/10 bg-[#f9f3e5]/95 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.1)] md:p-8">
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
