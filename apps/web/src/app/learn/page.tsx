"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, UserCircle, Star, Play, Lock, Check, X } from "lucide-react";
import { LESSONS } from "@/constants";
import { Lesson } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// レイアウト定数
const ROW_HEIGHT = 160; 
const AMPLITUDE = 60;   
const CENTER_X = 200;   
const OFFSET_Y = 60;    

export default function LearnPage() {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const selectedLesson = LESSONS.find((l) => l.id === selectedLessonId);

  const handleNodeClick = (lesson: Lesson) => {
    if (lesson.status === "locked") return;
    setSelectedLessonId(lesson.id);
  };

  const totalHeight = OFFSET_Y + (LESSONS.length * ROW_HEIGHT) + 100;

  return (
    <div className="min-h-screen pb-20 bg-[#f6f1e6] text-[#2b2b2b]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f9f3e5]/95 border-b border-black/10 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 md:px-8 xl:px-[220px] h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight select-none hover:opacity-80">
            <span>Shogi AI</span>
            <span className="text-[#555] ml-1">Learning</span>
          </Link>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
              <Bell className="w-6 h-6 text-[#555]" />
            </button>
            <button className="p-1 hover:bg-black/5 rounded-full transition-colors">
              <UserCircle className="w-8 h-8 text-[#555]" />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24">
        <div className="mx-auto max-w-6xl px-4 md:px-8 xl:px-[220px]">
          <div className="rounded-3xl bg-[#f9f3e5] border border-black/10 shadow-[0_20px_40px_rgba(0,0,0,0.1)] p-6 md:p-8">
            <div className="flex items-start gap-4 mb-10">
              <div className="flex-1 rounded-2xl rounded-tr-none bg-white/90 border border-black/5 p-4 relative text-slate-700">
                <div className="absolute -right-2 top-2 w-4 h-4 bg-white/90 border-r border-t border-black/5 rotate-45" />
                <div className="text-xs font-bold text-[#b67a3c] mb-1">将棋仙人</div>
                <p className="text-sm leading-relaxed">一歩ずつ進むのじゃ。焦りは禁物じゃぞ。</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-amber-500/90 border-2 border-[#fef5dc] flex items-center justify-center text-2xl shadow-lg text-[#2b2b2b]">
                👴
              </div>
            </div>

            <div 
              className="relative w-full max-w-[400px] mx-auto select-none"
              style={{ height: `${totalHeight}px` }}
            >
              <div className="absolute inset-0 pointer-events-none z-0">
                  <RoadmapPath lessons={LESSONS} totalHeight={totalHeight} />
              </div>
              
              <div className="relative z-10 w-full h-full pointer-events-none">
                {LESSONS.map((lesson, index) => (
                  <LessonNode
                    key={lesson.id}
                    lesson={lesson}
                    index={index}
                    onClick={() => handleNodeClick(lesson)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal (Dialog) */}
      <Dialog open={!!selectedLesson} onOpenChange={(open) => !open && setSelectedLessonId(null)}>
        <DialogContent className="fixed z-[99999] left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#fdf8ee] p-6 shadow-2xl border border-black/10 gap-0 [&>button]:hidden">
          {selectedLesson && (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-xs font-bold text-[#b67a3c] uppercase tracking-wider mb-1">
                    {selectedLesson.category === "basics" || selectedLesson.category === "piece-move" ? "駒の動き" : "一手詰み"}
                  </div>
                  <DialogTitle className="text-2xl font-bold text-[#3a2b17]">{selectedLesson.title}</DialogTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedLessonId(null)}
                  className="h-8 w-8 rounded-full hover:bg-black/5 text-[#555]"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <DialogDescription className="text-slate-700 mb-6 leading-relaxed text-base">
                {selectedLesson.description}
              </DialogDescription>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">難易度:</span>
                  <div className="flex">
                    {[...Array(3)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < (selectedLesson.stars || 0) ? "text-[#555]" : "text-[#555]/30"}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-sm font-bold text-emerald-600">
                  {selectedLesson.status === "completed" ? "クリア済み" : "スタートできます"}
                </div>
              </div>

              <DialogFooter className="sm:justify-center">
                <Link
                  href={`/training/${selectedLesson.category}/${selectedLesson.id}`}
                  className="w-full"
                >
                  <Button className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-[#fdf8ee] font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-base">
                    <Play className="w-5 h-5 text-[#fdf8ee]" fill="currentColor" />
                    レッスンを始める
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- 以下、RoadmapPath と LessonNode は前回のままでOKです ---
// もしエラーが出る場合は、前回のコードの後半部分をここに貼り付けてください。
// ここではスペース節約のため省略していませんが、そのまま使ってください。

function RoadmapPath({ lessons, totalHeight }: { lessons: Lesson[]; totalHeight: number }) {
  let d = `M ${CENTER_X} ${OFFSET_Y}`;
  lessons.forEach((_, i) => {
    if (i === lessons.length - 1) return;
    const startY = OFFSET_Y + i * ROW_HEIGHT;
    const endY = OFFSET_Y + (i + 1) * ROW_HEIGHT;
    const startX = CENTER_X + Math.sin(i * 1.5) * AMPLITUDE;
    const endX = CENTER_X + Math.sin((i + 1) * 1.5) * AMPLITUDE;
    const cp1Y = startY + ROW_HEIGHT * 0.5;
    const cp2Y = endY - ROW_HEIGHT * 0.5;
    d += ` C ${startX} ${cp1Y}, ${endX} ${cp2Y}, ${endX} ${endY}`;
  });
  return (
    <svg className="absolute top-0 left-0 w-full h-full overflow-visible" viewBox={`0 0 400 ${totalHeight}`}>
      <path d={d} fill="none" stroke="#d4c7ac" strokeWidth="10" strokeDasharray="20 15" strokeLinecap="round"/>
    </svg>
  );
}

function LessonNode({ lesson, index, onClick }: { lesson: Lesson; index: number; onClick: () => void }) {
  const leftPos = CENTER_X + Math.sin(index * 1.5) * AMPLITUDE;
  const topPos = OFFSET_Y + index * ROW_HEIGHT;
  const isCompleted = lesson.status === "completed";
  const isAvailable = lesson.status === "available";
  const isLocked = lesson.status === "locked";

  return (
    <div 
      className="absolute flex flex-col items-center justify-center"
      style={{ left: `${leftPos}px`, top: `${topPos}px`, transform: 'translate(-50%, -50%)', width: 'auto', zIndex: 50 }}
    >
      {!isLocked && (
        <div className="flex gap-1 mb-2 absolute -top-10 pointer-events-none">
          {[1, 2, 3].map((star) => (
            <Star key={star} className={`w-5 h-5 ${star <= (lesson.stars || 0) ? "text-[#555]" : "text-[#555]/30"}`} />
          ))}
        </div>
      )}
      <div 
        className={`relative group transition-transform active:scale-95 pointer-events-auto ${!isLocked ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        {isAvailable && <div className="absolute inset-0 bg-amber-200/60 rounded-full blur-xl animate-pulse"></div>}
        <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-[0_8px_0_0_rgba(0,0,0,0.15)] border-4 border-white relative z-10 transition-colors ${isCompleted ? "bg-gradient-to-b from-indigo-400 to-blue-500" : ""} ${isAvailable ? "bg-gradient-to-b from-amber-200 to-orange-300" : ""} ${isLocked ? "bg-slate-200" : ""}`}>
          {isCompleted && <Check className="w-10 h-10 text-[#555] drop-shadow-md" strokeWidth={4} />}
          {isAvailable && <Play className="w-10 h-10 text-[#555] fill-[#555] drop-shadow-md ml-1" />}
          {isLocked && <Lock className="w-8 h-8 text-[#555]/40" />}
          {!isLocked && <div className="absolute top-2 left-4 w-6 h-3 bg-white/20 rounded-full transform -rotate-45"></div>}
        </div>
      </div>
      <div className="mt-4 bg-white/90 border border-black/5 px-3 py-1.5 rounded-xl shadow w-max text-center pointer-events-none">
        <span className={`text-sm font-bold ${isLocked ? "text-slate-400" : "text-[#3a2b17]"}`}>{lesson.title}</span>
      </div>
    </div>
  );
}