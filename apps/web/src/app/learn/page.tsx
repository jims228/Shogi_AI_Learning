"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, UserCircle, Star, Play, Lock, Check, X } from "lucide-react";
import { LESSONS } from "@/constants";
import { Lesson } from "@/types";

export default function LearnPage() {
  const router = useRouter();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const selectedLesson = LESSONS.find((l) => l.id === selectedLessonId);

  const handleNodeClick = (lesson: Lesson) => {
    if (lesson.status === "locked") return;
    setSelectedLessonId(lesson.id);
  };

  const handleStartLesson = () => {
    if (!selectedLesson) return;
    // Navigate to lesson page
    // e.g. /training/piece-move/piece_pawn_basic
    router.push(`/training/${selectedLesson.category}/${selectedLesson.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20 font-sans relative overflow-hidden">
      {/* Header (Same as Home) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
           {/* Logo */}
           <Link href="/" className="font-bold text-xl tracking-tight select-none hover:opacity-80 transition-opacity">
             <span className="text-white">Shogi AI</span>
             <span className="text-sky-400 ml-1">Learning</span>
           </Link>
           {/* Icons */}
           <div className="flex items-center gap-4">
             <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
               <Bell className="w-6 h-6 text-slate-300" />
             </button>
             <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
               <UserCircle className="w-8 h-8 text-slate-300" />
             </button>
           </div>
        </div>
      </header>

      <main className="pt-24 px-4 max-w-md mx-auto">
        
        {/* Coach Message Bubble */}
        <div className="mb-12 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex-1 bg-slate-800/80 border border-white/10 rounded-2xl rounded-tr-none p-4 relative shadow-lg">
            <div className="absolute -right-2 top-0 w-4 h-4 bg-slate-800/80 border-t border-r border-white/10 transform rotate-45 translate-x-1/2 translate-y-1/2"></div>
            <div className="text-xs font-bold text-amber-400 mb-1">将棋仙人</div>
            <p className="text-sm text-slate-200 leading-relaxed">
              一歩ずつ進むのじゃ。焦りは禁物じゃぞ。
            </p>
          </div>
          <div className="w-14 h-14 rounded-full bg-amber-600 border-2 border-slate-900 flex items-center justify-center text-2xl shadow-xl flex-shrink-0">
            👴
          </div>
        </div>

        {/* Roadmap Container */}
        <div className="relative min-h-[800px] pb-20">
          {/* Background Path (SVG) */}
          <RoadmapPath lessons={LESSONS} />

          {/* Nodes */}
          <div className="relative z-10 space-y-8">
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

      </main>

      {/* Detail Panel (Bottom Sheet style for mobile/desktop) */}
      {selectedLesson && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center pointer-events-none">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={() => setSelectedLessonId(null)}
          />
          
          {/* Panel */}
          <div className="bg-slate-900 border border-white/10 w-full max-w-md sm:rounded-2xl rounded-t-2xl p-6 shadow-2xl transform transition-transform duration-300 pointer-events-auto animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">
                  {selectedLesson.category === "piece-move" ? "駒の動き" : "一手詰み"}
                </div>
                <h2 className="text-2xl font-bold text-white">{selectedLesson.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedLessonId(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <p className="text-slate-300 mb-6 leading-relaxed">
              {selectedLesson.description}
            </p>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">難易度:</span>
                <div className="flex">
                  {[...Array(3)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < (selectedLesson.stars || 0) ? "text-amber-400 fill-amber-400" : "text-slate-700"}`} />
                  ))}
                </div>
              </div>
              <div className="text-sm font-bold text-green-400">
                {selectedLesson.status === "completed" ? "クリア済み" : "スタートできます"}
              </div>
            </div>

            <button
              onClick={handleStartLesson}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              レッスンを始める
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Component to draw the curved dashed line behind nodes
function RoadmapPath({ lessons }: { lessons: Lesson[] }) {
  // Calculate path points
  // We assume each node takes up roughly 120px vertical space (node + gap)
  // We'll oscillate the X position.
  const rowHeight = 140; // Adjust based on spacing
  const amplitude = 60; // Horizontal sway amount
  const centerX = 200; // Center of the SVG (assuming 400px width container)
  
  // Generate path string
  let d = `M ${centerX} 40`; // Start point (top center-ish)

  lessons.forEach((_, i) => {
    if (i === lessons.length - 1) return;
    
    const startY = 40 + i * rowHeight;
    const endY = 40 + (i + 1) * rowHeight;
    
    // Zig-zag logic: 0 -> -1 -> 0 -> 1 -> 0
    // Let's use sine wave for smoother curves
    const startX = centerX + Math.sin(i * 1.5) * amplitude;
    const endX = centerX + Math.sin((i + 1) * 1.5) * amplitude;

    // Control points for Bezier curve
    const cp1Y = startY + rowHeight * 0.5;
    const cp2Y = endY - rowHeight * 0.5;

    d += ` C ${startX} ${cp1Y}, ${endX} ${cp2Y}, ${endX} ${endY}`;
  });

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
      <path
        d={d}
        fill="none"
        stroke="#334155" // slate-700
        strokeWidth="10"
        strokeDasharray="20 15"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LessonNode({ lesson, index, onClick }: { lesson: Lesson; index: number; onClick: () => void }) {
  // Calculate horizontal offset to match the SVG path
  const amplitude = 60;
  const xOffset = Math.sin(index * 1.5) * amplitude;
  
  const isCompleted = lesson.status === "completed";
  const isAvailable = lesson.status === "available";
  const isLocked = lesson.status === "locked";

  return (
    <div 
      className="flex flex-col items-center justify-center relative"
      style={{ transform: `translateX(${xOffset}px)` }}
    >
      {/* Stars (Progress) */}
      {!isLocked && (
        <div className="flex gap-1 mb-2 absolute -top-8 animate-in fade-in zoom-in duration-500 delay-100">
          {[1, 2, 3].map((star) => (
            <Star 
              key={star} 
              className={`w-5 h-5 ${star <= (lesson.stars || 0) ? "text-amber-400 fill-amber-400" : "text-slate-700 fill-slate-800"}`} 
            />
          ))}
        </div>
      )}

      {/* Node Circle */}
      <div 
        className="relative group cursor-pointer transition-transform active:scale-95"
        onClick={onClick}
      >
        {/* Glow for available */}
        {isAvailable && (
          <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-xl animate-pulse"></div>
        )}
        
        {/* Main Circle */}
        <div 
          className={`
            w-24 h-24 rounded-full flex items-center justify-center shadow-[0_8px_0_0_rgba(0,0,0,0.3)] border-4 border-slate-900 relative z-10
            ${isCompleted ? "bg-gradient-to-b from-indigo-500 to-blue-600" : ""}
            ${isAvailable ? "bg-gradient-to-b from-amber-400 to-orange-500" : ""}
            ${isLocked ? "bg-slate-700" : ""}
          `}
        >
          {/* Inner Icon */}
          {isCompleted && <Check className="w-10 h-10 text-white drop-shadow-md" strokeWidth={4} />}
          {isAvailable && <Play className="w-10 h-10 text-white fill-white drop-shadow-md ml-1" />}
          {isLocked && <Lock className="w-8 h-8 text-slate-400/50" />}
          
          {/* Shine effect */}
          {!isLocked && (
            <div className="absolute top-2 left-4 w-6 h-3 bg-white/20 rounded-full transform -rotate-45"></div>
          )}
        </div>
      </div>

      {/* Label Pill */}
      <div className="mt-3 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl shadow-lg z-20 max-w-[160px] text-center">
        <span className={`text-sm font-bold ${isLocked ? "text-slate-500" : "text-slate-200"}`}>
          {lesson.title}
        </span>
      </div>
    </div>
  );
}


