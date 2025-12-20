"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type LessonScaffoldProps = {
  title: string;
  backHref: string;
  board: React.ReactNode;
  explanation: React.ReactNode;
  mascot: React.ReactNode;

  // 互換 props
  topLabel?: string;
  progress01?: number; // 0..1
  headerRight?: React.ReactNode;
  desktopMinWidthPx?: number; // default 820
  mobileMascotScale?: number;

  // ★追加：モバイル下部の固定アクション（次へボタンをここに出す）
  mobileAction?: React.ReactNode;
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
  mobileMascotScale = 0.78,
  mobileAction,
}: LessonScaffoldProps) {
  const isDesktop = useMediaQuery(`(min-width: ${desktopMinWidthPx}px)`);

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

        <div className="font-bold text-sm md:text-base text-[#3a2b17] flex-1 text-center">
          {title}
        </div>

        <div className="min-w-[80px] flex justify-end">{headerRight ?? <span />}</div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        {isDesktop ? (
          // Desktop: 左=盤面 / 右=解説+マスコット（今まで通り）
          <div className="h-full min-h-0 grid grid-cols-12 gap-6 p-4 md:p-6">
            <section className="col-span-8 h-full min-h-0 flex items-center justify-center">
              {board}
            </section>

            <section className="col-span-4 h-full min-h-0 flex flex-col gap-4">
              <div className="flex-none">
                {topLabel ? (
                  <div className="text-xs font-bold tracking-wide text-slate-500 mb-2">
                    {topLabel}
                  </div>
                ) : null}

                {typeof progress01 === "number" ? (
                  <div className="h-1 bg-black/10 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round(progress01 * 100)}%` }}
                    />
                  </div>
                ) : null}

                {explanation}
              </div>

              <div className="flex-1 min-h-0 flex items-end justify-center pb-2">
                {mascot}
              </div>
            </section>
          </div>
        ) : (
          // Mobile: ★1画面固定（スクロール無し）
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            {/* Top HUD（固定高）：左=おじいちゃん / 右=解説 */}
            <div className="relative shrink-0 px-3 pt-3">
              {topLabel ? (
                <div className="text-[11px] font-bold tracking-wide text-slate-500">
                  {topLabel}
                </div>
              ) : null}

              {typeof progress01 === "number" ? (
                <div className="mt-2 h-1 bg-black/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round(progress01 * 100)}%` }}
                  />
                </div>
              ) : null}

              {/* top row */}
              <div
                className="mt-3 grid grid-cols-[120px,1fr] gap-3 items-start"
                style={{ height: "min(180px, 24dvh)" }}
              >
                {/* Mascot (peek) */}
                <div className="relative">
                  {/* ここで下にはみ出させる → 下の盤が後から描画されて胴体が隠れる */}
                  <div
                    className="absolute left-0 bottom-[-26px] origin-bottom-left pointer-events-none"
                    style={{ transform: `scale(${mobileMascotScale})` }}
                  >
                    {mascot}
                  </div>
                  {/* レイアウト用の箱 */}
                  <div className="h-full" />
                </div>

                {/* Explanation (右上) */}
                <div className="min-w-0">
                  {/* 高さを制限して1画面固定。中身はページ側で “モバイルは短く” するのが理想 */}
                  <div className="max-h-[180px] overflow-hidden">
                    {explanation}
                  </div>
                </div>
              </div>
            </div>

            {/* Board area（残り全部） */}
            <div className="flex-1 min-h-0 overflow-hidden px-3 pb-2">
              <div className="h-full min-h-0 flex items-end justify-center">
                {board}
              </div>
            </div>

            {/* Bottom action bar（固定）：次へボタンはここ */}
            <div className="shrink-0 border-t border-black/10 bg-white/40 backdrop-blur px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
              {mobileAction ? mobileAction : <div className="h-12" />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
