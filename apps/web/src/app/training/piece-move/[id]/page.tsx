"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Board } from "@/components/Board";
import { Placed } from "@/lib/sfen";
import { ArrowLeft, CheckCircle, ChevronRight } from "lucide-react";

// Simple lesson data (hardcoded for now as requested)
const LESSON_DATA: Record<string, {
  initialPieces: Placed[];
  targetSquare: { x: number; y: number };
  pieceToMove: { x: number; y: number }; // Where the piece starts
  steps: string[];
}> = {
  "piece_pawn_basic": {
    initialPieces: [
      { piece: "P", x: 2, y: 6 }, // 7七 歩 (x=2, y=6) -> 9-7=2, 7-1=6
      { piece: "K", x: 4, y: 8 }, // 5九 玉
    ],
    pieceToMove: { x: 2, y: 6 },
    targetSquare: { x: 2, y: 5 }, // 7六 (x=2, y=5)
    steps: [
      "歩は前に一マスだけ進めます。",
      "ハイライトされたマスをクリックして、歩を動かしてみましょう。",
    ]
  },
  "piece_move_basic_2": {
     initialPieces: [
      { piece: "L", x: 0, y: 8 }, // 9九 香
      { piece: "K", x: 4, y: 8 }, // 5九 玉
    ],
    pieceToMove: { x: 0, y: 8 },
    targetSquare: { x: 0, y: 4 }, // 9五 (example)
    steps: [
      "香車は前にどこまでも進めます。",
      "ただし、駒を飛び越えることはできません。",
    ]
  }
};

export default function PieceMoveLessonPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const lesson = LESSON_DATA[id];
  
  const [pieces, setPieces] = useState<Placed[]>([]);
  const [step, setStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (lesson) {
      setPieces(lesson.initialPieces);
      setMessage(lesson.steps[0]);
    }
  }, [lesson]);

  if (!lesson) {
    return <div className="min-h-screen bg-[#f6f1e6] text-[#2b2b2b] p-8">Lesson not found</div>;
  }

  const handleSquareClick = (x: number, y: number) => {
    if (isCompleted) return;

    // Check if clicked target
    if (x === lesson.targetSquare.x && y === lesson.targetSquare.y) {
      // Move piece
      const newPieces = pieces.map(p => {
        if (p.x === lesson.pieceToMove.x && p.y === lesson.pieceToMove.y) {
          return { ...p, x, y };
        }
        return p;
      });
      setPieces(newPieces);
      setIsCompleted(true);
      setMessage("正しい動きです！レッスン完了！");
    } else {
      // Optional: feedback for wrong move
    }
  };

  const handleFinish = () => {
    // Mark as completed (mock)
    // In a real app, call API or update global state
    router.push("/learn");
  };

  return (
    <div className="min-h-screen bg-[#f6f1e6] text-[#2b2b2b] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-black/10 flex items-center px-4 bg-[#f9f3e5]/95">
        <Link href="/learn" className="flex items-center text-[#555] hover:text-[#2b2b2b] transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2 text-[#555]" />
          マップに戻る
        </Link>
        <h1 className="ml-4 font-bold text-lg">駒の動きレッスン</h1>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-6xl mx-auto w-full p-4 gap-8">
        {/* Left: Board */}
        <div className="flex-1 flex items-center justify-center bg-[#fef8e6] rounded-2xl border border-black/10 p-4 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
          <Board 
            pieces={pieces} 
            highlightSquares={!isCompleted ? [lesson.targetSquare] : []}
            onSquareClick={handleSquareClick}
          />
        </div>

        {/* Right: Instructions */}
        <div className="w-full md:w-96 flex flex-col gap-6">
          <div className="bg-[#fdf3de] border border-black/10 rounded-2xl p-6 shadow-[0_10px_25px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#fef1d6] flex items-center justify-center font-bold text-xl text-[#2b2b2b]">
                {isCompleted ? <CheckCircle className="w-6 h-6 text-[#555]" /> : (step + 1)}
              </div>
              <h2 className="font-bold text-xl">
                {isCompleted ? "クリア！" : "ステップ " + (step + 1)}
              </h2>
            </div>
            
            <p className="text-lg text-[#444] leading-relaxed mb-6">
              {message}
              {!isCompleted && step === 0 && lesson.steps[1] && (
                <span className="block mt-2 text-slate-500 text-sm">
                  {lesson.steps[1]}
                </span>
              )}
            </p>

            {isCompleted && (
              <button
                onClick={handleFinish}
                className="w-full py-3 bg-[#e3f6d4] hover:bg-[#d1ecbc] text-[#2b2b2b] font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 border border-black/10"
              >
                マップに戻る
                <ChevronRight className="w-5 h-5 text-[#555]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
