"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ArrowRight, Lightbulb } from "lucide-react";

import { ShogiBoard } from "@/components/ShogiBoard";
import { ManRive } from "@/components/ManRive";
import { AutoScaleToFit } from "@/components/training/AutoScaleToFit";
import { WoodBoardFrame } from "@/components/training/WoodBoardFrame";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LessonScaffold } from "@/components/training/lesson/LessonScaffold";

import { PAWN_LESSON_3_TSUGIFU_STEPS } from "@/constants/rulesData";
import { showToast } from "@/components/ui/toast";
import { buildPositionFromUsi } from "@/lib/board";

const normalizeUsiPosition = (s: string) => {
  const t = (s ?? "").trim();
  if (!t) return "position startpos";
  if (t.startsWith("position ")) return t;
  if (t.startsWith("startpos")) return `position ${t}`;
  if (t.startsWith("sfen ")) return `position ${t}`;
  return `position sfen ${t}`;
};

export default function TsugifuTrainingPage() {
  const router = useRouter();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [board, setBoard] = useState<any[][]>([]);
  const [hands, setHands] = useState<any>({ b: {}, w: {} });
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctSignal, setCorrectSignal] = useState(0);

  const currentLesson = PAWN_LESSON_3_TSUGIFU_STEPS[currentStepIndex];

  // DEBUG: set true to force-show fixed hints for visual debugging
  const DEBUG_OVERLAY = false;

  // レイアウト判定（Scaffoldと揃える）
  const isDesktop = useMediaQuery("(min-width: 820px)");

  // reset phaseIndex when step changes
  useEffect(() => {
    setPhaseIndex(0);
  }, [currentLesson]);

  // When step or phase changes, load the appropriate SFEN
  useEffect(() => {
    if (!currentLesson) return;
    const currentPhase = currentLesson.scriptPhases?.[phaseIndex];
    const sfenToLoad = currentPhase?.sfen ?? currentLesson.sfen;
    try {
      const initial = buildPositionFromUsi(normalizeUsiPosition(sfenToLoad));
      setBoard(initial.board);
      setHands((initial as any).hands ?? { b: {}, w: {} });
    } catch (e) {
      console.error("SFEN Parse Error", e);
    }
    setIsCorrect(false);
  }, [currentLesson, phaseIndex]);

  // Auto-advance phases (1,3,5) as snapshots: advance shortly after entering
  useEffect(() => {
    if (!currentLesson?.scriptPhases) return;
    const autoPhases = [1, 3, 5];
    const lastIndex = currentLesson.scriptPhases.length - 1;
    if (autoPhases.includes(phaseIndex) && phaseIndex < lastIndex) {
      const t = setTimeout(() => setPhaseIndex((p) => p + 1), 150);
      return () => clearTimeout(t);
    }
  }, [phaseIndex, currentLesson]);

  // Show per-phase successMessage when entering a phase that defines it
  useEffect(() => {
    if (!currentLesson?.scriptPhases) return;
    const phase = currentLesson.scriptPhases[phaseIndex];
    if (phase?.successMessage) {
      // mark correct to show mascot overlay only; avoid global toasts/duplicate displays
      setIsCorrect(true);
    }
  }, [phaseIndex, currentLesson]);

  const handleMove = useCallback(
    (move: { from?: { x: number; y: number }; to: { x: number; y: number }; piece: string; drop?: boolean }) => {
      // If this lesson has scripted phases, use the current phase's checkMove
      const currentPhase = currentLesson.scriptPhases?.[phaseIndex];
      const checker = currentPhase?.checkMove ?? currentLesson.checkMove;
      const correct = checker(move);

      if (correct) {
        setIsCorrect(true);
        setCorrectSignal((v) => v + 1);

        if (currentLesson.scriptPhases) {
          const lastIndex = currentLesson.scriptPhases.length - 1;
          if (phaseIndex < lastIndex) {
            // advance phase
            setPhaseIndex((p) => p + 1);
          } else {
            // final phase reached: do not advance stepIndex (stay on Step1)
            // final phase's successMessage (if any) is handled by effect on phaseIndex
          }
        } else {
          // non-scripted lesson: show immediate success toast
          showToast({ title: "正解！", description: currentLesson.successMessage });
        }
      } else {
        showToast({ title: "惜しい！", description: "その手ではありません。もう一度考えてみましょう。" });

        setTimeout(() => {
          // reload current phase (or step) SFEN
          const reloadPhase = currentLesson.scriptPhases?.[phaseIndex];
          const sfenToLoad = reloadPhase?.sfen ?? currentLesson.sfen;
          try {
            const initial = buildPositionFromUsi(normalizeUsiPosition(sfenToLoad));
            setBoard(initial.board);
            setHands((initial as any).hands ?? { b: {}, w: {} });
          } catch (e) {
            console.error("SFEN Parse Error", e);
          }
        }, 900);
      }
    },
    [currentLesson, phaseIndex],
  );

  const handleNext = () => {
    if (currentStepIndex < PAWN_LESSON_3_TSUGIFU_STEPS.length - 1) setCurrentStepIndex((p) => p + 1);
    else router.push("/learn/roadmap");
  };

  if (!currentLesson) return <div className="p-10">読み込み中...</div>;

  const nextButton = isCorrect ? (
    <button
      onClick={handleNext}
      className="mt-3 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
    >
      {currentStepIndex < PAWN_LESSON_3_TSUGIFU_STEPS.length - 1 ? "次のステップへ" : "レッスン完了！"}
      <ArrowRight className="w-5 h-5" />
    </button>
  ) : null;

  // ===== 盤面（左側に常に出す）=====
  const boardElement = (
    <div className="w-full h-full flex items-start justify-center overflow-auto">
      <div
        className="w-full pb-10"
        style={{
          maxWidth: 760,
          aspectRatio: "1 / 1",
          minHeight: isDesktop ? 560 : 360,
        }}
      >
        <AutoScaleToFit minScale={0.7} maxScale={1.45} className="w-full h-full">
          <WoodBoardFrame paddingClassName="p-3" className="inline-block">
            <div className="relative inline-block">
              <ShogiBoard
                board={board}
                hands={hands}
                mode="edit"
                onMove={handleMove}
                onBoardChange={setBoard}
                onHandsChange={setHands}
                orientation="sente"
                hintSquares={currentLesson.scriptPhases?.[phaseIndex]?.hintSquares ?? currentLesson.hintSquares ?? []}
                hintArrows={currentLesson.scriptPhases?.[phaseIndex]?.hintArrows ?? currentLesson?.hintArrows ?? []}
              />

              {/* Overlay is rendered inside ShogiBoard component now. */}
            </div>
          </WoodBoardFrame>
        </AutoScaleToFit>
      </div>
    </div>
  );


  // ===== 解説（右上）=====
  const explanationElement = (
    <div className="bg-white/80 backdrop-blur rounded-2xl shadow border border-black/10 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <span>STEP {currentStepIndex + 1}</span>
        <span className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
          <span
            className="block h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${((currentStepIndex + 1) / PAWN_LESSON_3_TSUGIFU_STEPS.length) * 100}%` }}
          />
        </span>
        <span>{PAWN_LESSON_3_TSUGIFU_STEPS.length}</span>
      </div>

      <div className="mt-3">
        <h1 className="text-xl font-bold text-[#3a2b17]">{currentLesson.title}</h1>

        <div className="mt-3 flex items-start gap-3 bg-amber-50/80 p-3 rounded-2xl text-amber-900 border border-amber-200/50">
          <Lightbulb className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium text-sm">{
            // Dynamic explanation per interactive phase
            (() => {
              const phases = currentLesson.scriptPhases;
              if (!phases) return currentLesson.description;
              const phase = phases[phaseIndex];
              // If this phase has a final success message and we've just marked correct, show it
              if (isCorrect && phase?.successMessage) return phase.successMessage;
              // Map interactive phases to short hints for the user
              switch (phaseIndex) {
                case 0:
                  return "まずは、突き捨て";
                case 2:
                  return "そして継ぎ歩！！";
                case 4:
                  return "最後に垂れ歩";
                default:
                  return currentLesson.description;
              }
            })()
          }</p>
        </div>

        {isCorrect && (
          <div className="animate-in fade-in zoom-in-95 duration-300 mt-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-emerald-800 mb-1">Excellent!</h3>
              {/* Success text intentionally shown only on mascot overlay; keep this box concise */}
            </div>
          </div>
        )}

        {isDesktop && nextButton}
      </div>
    </div>
  );

  // ===== おじいちゃん（右下）=====
  const mascotElement = (
    <div style={{ transform: "translateY(-12px)" }}>
      <ManRive
        correctSignal={correctSignal}
        className="bg-transparent [&>canvas]:bg-transparent"
        style={{
          width: isDesktop ? 380 : 260,
          height: isDesktop ? 380 : 260,
        }}
      />
    </div>
  );

  // remove mascot overlay text; final success message shown in explanation area instead
  const mascotOverlay = null;

  return (
    <LessonScaffold
      title="継ぎ歩（復習）"
      backHref="/learn/roadmap"
      board={boardElement}
      explanation={explanationElement}
      mascot={mascotElement}
      mascotOverlay={mascotOverlay}
      topLabel="DRILL"
      progress01={(currentStepIndex + 1) / PAWN_LESSON_3_TSUGIFU_STEPS.length}
      headerRight={<span>❤ 4</span>}
      desktopMinWidthPx={820}
      mobileAction={!isDesktop ? nextButton : null}
    />
  );
}
