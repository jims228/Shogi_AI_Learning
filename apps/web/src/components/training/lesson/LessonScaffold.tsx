"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AutoScaleToFit } from "@/components/training/AutoScaleToFit";

export type LessonScaffoldProps = {
  title: string;
  backHref: string;
  board: React.ReactNode;
  explanation: React.ReactNode;
  mascot: React.ReactNode;

  topLabel?: string;
  progress01?: number; // 0..1
  headerRight?: React.ReactNode;
  desktopMinWidthPx?: number; // default 820
  mobileMascotScale?: number; // 互換用（未使用でもOK）
};

export function LessonScaffold({
  title,
  backHref,
  board,
  explanation,
  mascot,
  topLabel,
  progress01,
  headerRight,
  desktopMinWidthPx = 820,
}: LessonScaffoldProps) {
  // 幅ベース（従来）
  const isWide = useMediaQuery(`(min-width: ${desktopMinWidthPx}px)`);
  // デバイス特性ベース：PCっぽい(マウス操作)ならtrue
  const isPcLike = useMediaQuery("(hover: hover) and (pointer: fine)");

  // PCっぽいなら、ウィンドウ幅が小さくても「PCレイアウト」を維持する
  const useDesktopLayout = isPcLike || isWide;

  const TopMeta = (
    <>
      {topLabel ? (
        <div className="text-xs font-bold tracking-wide text-slate-500 mb-2">{topLabel}</div>
      ) : null}

      {typeof progress01 === "number" ? (
        <div className="h-1 bg-black/10 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.round(progress01 * 100)}%` }}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="fixed inset-0 z-[9999] h-[100dvh] w-[100dvw] overflow-hidden bg-[#f6f1e6] text-[#2b2b2b] flex flex-col">
      {/* Header */}
      <header className="h-12 md:h-14 flex items-center justify-between px-3 md:px-6 border-b border-black/10 bg-white/40 backdrop-blur shrink-0">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden sm:inline">学習マップ</span>
        </Link>

        <div className="font-bold text-sm md:text-base text-[#3a2b17] flex-1 text-center">{title}</div>

        <div className="min-w-[80px] flex justify-end">{headerRight ?? <span />}</div>
      </header>

      {/* Body */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {useDesktopLayout ? (
          // PCレイアウト（幅が小さくても崩さない）
          <div className="h-full min-h-0 grid grid-cols-12 gap-3 md:gap-6 p-3 md:p-6">
            {/* Left: board */}
            <section className="col-span-8 h-full min-h-0 overflow-hidden flex items-center justify-center px-1 md:px-2">
              {board}
            </section>

            {/* Right: explanation + mascot（高さが足りなければ右側だけ縮小して収める） */}
            <section className="col-span-4 h-full min-h-0 overflow-hidden flex items-center justify-center">
              <AutoScaleToFit minScale={0.6} maxScale={1} className="w-full h-full">
                <div className="w-[420px] max-w-full flex flex-col gap-4">
                  <div className="flex-none">
                    {TopMeta}
                    {explanation}
                  </div>
                  <div className="flex-1 min-h-0 flex items-end justify-center pb-2">
                    {mascot}
                  </div>
                </div>
              </AutoScaleToFit>
            </section>
          </div>
        ) : (
          // Touch(スマホ/タブレット)は縦並び（ここはスクロールOK）
          <div className="h-full min-h-0 overflow-auto p-4 flex flex-col gap-4">
            {TopMeta}
            {board}
            {explanation}
            <div className="flex justify-center">{mascot}</div>
          </div>
        )}
      </main>
    </div>
  );
}
