"use client";
import React from "react";
import AnnotateView from "@/components/AnnotateView";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AnnotatePage() {
  return (
    <div className="min-h-screen bg-shogi-dark text-white font-sans selection:bg-shogi-gold/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-shogi-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              棋譜注釈
            </h1>
          </div>
        </div>
      </header>

      <main className="w-full">
        <AnnotateView />
      </main>
    </div>
  );
}
