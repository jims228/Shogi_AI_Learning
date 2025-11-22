"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import LocalPlay from "@/components/play/LocalPlay";

export default function PlayPage() {
  return (
    <main className="min-h-screen p-6 pb-24 md:p-12 max-w-7xl mx-auto relative">
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        <Link 
          href="/" 
          className="p-2 rounded-full bg-shogi-panel text-slate-400 hover:text-white hover:bg-white/10 transition-colors border border-white/5"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Swords className="text-blue-400" size={32} />
            実践対局
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AIやローカル対局で腕を磨きましょう。
          </p>
        </div>
      </header>

      {/* Main Content */}
      <LocalPlay />
    </main>
  );
}
