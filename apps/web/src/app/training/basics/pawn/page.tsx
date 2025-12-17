"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CheckCircle, ArrowRight, Lightbulb } from "lucide-react";
import { ShogiBoard } from "@/components/ShogiBoard"; 
import { ManRive } from "@/components/ManRive";
import { TrainingLayout } from "@/components/training/TrainingLayout";
import { PAWN_LESSONS } from "@/constants/rulesData";
import { showToast } from "@/components/ui/toast";
import { buildPositionFromUsi } from "@/lib/board"; 

const normalizeUsiPosition = (s: string) => {
  const t = (s ?? "").trim();
  if (!t) return "position startpos";

  if (t.startsWith("position ")) return t;
  if (t.startsWith("startpos")) return `position ${t}`;
  if (t.startsWith("sfen ")) return `position ${t}`;
  return `position sfen ${t}`; // SFEN本体だけが来たケースを想定
};

export default function PawnTrainingPage() {
  const router = useRouter();
  
  // 状態管理
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [board, setBoard] = useState<any[][]>([]); 
  const [hands, setHands] = useState<any>({ b: {}, w: {} });
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctSignal, setCorrectSignal] = useState(0);
  
  const currentLesson = PAWN_LESSONS[currentStepIndex];

  // ステップが変わったら盤面を初期化
  useEffect(() => {
    if (currentLesson) {
      try {
        const initial = buildPositionFromUsi(normalizeUsiPosition(currentLesson.sfen));
        setBoard(initial.board);
        setHands((initial as any).hands ?? { b: {}, w: {} });
      } catch (e) {
        console.error("SFEN Parse Error", e);
      }
      setIsCorrect(false);
    }
  }, [currentLesson]);

  // 駒を動かした時の処理
  const handleMove = useCallback((move: { from?: { x: number; y: number }; to: { x: number; y: number }; piece: string; drop?: boolean }) => {
    // 正解判定
    const correct = currentLesson.checkMove(move);

    if (correct) {
      setIsCorrect(true);
      setCorrectSignal((v) => v + 1);
      showToast({ title: "正解！", description: currentLesson.successMessage });
    } else {
      showToast({ title: "惜しい！", description: "その手ではありません。もう一度考えてみましょう。" });
      
      // 不正解なら1秒後に盤面を元に戻す
      setTimeout(() => {
        const initial = buildPositionFromUsi(normalizeUsiPosition(currentLesson.sfen));
        setBoard(initial.board);
        setHands((initial as any).hands ?? { b: {}, w: {} });
      }, 1000);
    }
  }, [currentLesson]);

  // 次へボタンの処理
  const handleNext = () => {
    if (currentStepIndex < PAWN_LESSONS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      router.push("/learn"); // 全クリしたら学習マップへ戻る
    }
  };

  if (!currentLesson) return <div className="p-10">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#f6f1e6] text-[#2b2b2b] flex flex-col">
      {/* ヘッダー */}
      <header className="h-16 border-b border-black/10 bg-white/50 flex items-center px-4 justify-between sticky top-0 z-10 backdrop-blur-sm">
        <Link href="/learn" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span>学習マップ</span>
        </Link>
        <div className="font-bold text-lg text-[#3a2b17]">基本の駒：歩兵</div>
        <div className="w-20" />
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 min-h-0 p-3 md:p-4 max-w-6xl mx-auto w-full">
        <TrainingLayout
          stickyRight
          left={
            <div className="flex min-h-0 items-center justify-center lg:justify-start">
              <div className="bg-[#f3c882] p-1 rounded-xl shadow-2xl border-4 border-[#5d4037]">
                <ShogiBoard
                  board={board}
                  hands={hands}
                  mode="edit"
                  onMove={handleMove}
                  onBoardChange={setBoard}
                  onHandsChange={setHands}
                  orientation="sente"
                />
              </div>
            </div>
          }
          rightTop={
            <div
              className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-sm border border-black/10 p-4"
            >
              {/* しっぽ（キャラ方向=右下） */}
              <div
                className="pointer-events-none absolute bottom-6 right-10 h-4 w-4 rotate-45 bg-white/90 border-b border-r border-black/10"
                aria-hidden
              />

              {/* 進捗 */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>STEP {currentStepIndex + 1}</span>
                <span className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <span
                    className="block h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${((currentStepIndex + 1) / PAWN_LESSONS.length) * 100}%` }}
                  />
                </span>
                <span>{PAWN_LESSONS.length}</span>
              </div>

              <div className="mt-3">
                <h1 className="text-xl font-bold text-[#3a2b17]">{currentLesson.title}</h1>

                <div className="mt-3 flex items-start gap-3 bg-amber-50/80 p-3 rounded-2xl text-amber-900 border border-amber-200/50">
                  <Lightbulb className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium text-sm">{currentLesson.description}</p>
                </div>

                {/* 正解時の表示（位置は吹き出し内へ） */}
                {isCorrect && (
                  <div className="animate-in fade-in zoom-in-95 duration-300 mt-4">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold text-emerald-800 mb-1">Excellent!</h3>
                      <p className="text-emerald-700 text-sm">{currentLesson.successMessage}</p>
                    </div>

                    <button
                      onClick={handleNext}
                      className="mt-3 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                    >
                      {currentStepIndex < PAWN_LESSONS.length - 1 ? "次のステップへ" : "レッスン完了！"}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          }
          rightBottom={
            <ManRive
              correctSignal={correctSignal}
              className="bg-transparent [&>canvas]:bg-transparent"
              style={{ width: 200, height: 200 }}
            />
          }
        />
      </main>
    </div>
  );
}