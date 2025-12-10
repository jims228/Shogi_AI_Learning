"use client";

import React from "react";
import Link from "next/link";
import { Bell, UserCircle, Map, Trophy, ArrowRight } from "lucide-react";

export default function LearnMenuPage() {
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

      <main className="pt-32 pb-16">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-[#3a2b17] mb-4">
              学習コースを選択
            </h1>
            <p className="text-slate-600 text-lg">
              将棋のスキルを向上させるためのトレーニングモードを選んでください。
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {/* Roadmap Card */}
            <Link href="/learn/roadmap" className="group relative">
              <div className="absolute inset-0 bg-amber-200/20 rounded-3xl transform transition-transform group-hover:scale-105 group-hover:rotate-1"></div>
              <div className="relative h-full bg-white rounded-3xl border border-black/5 shadow-xl p-8 flex flex-col items-center text-center transition-transform group-hover:-translate-y-1">
                <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 group-hover:bg-amber-200 transition-colors">
                  <Map className="w-10 h-10 text-amber-700" />
                </div>
                <h2 className="text-2xl font-bold text-[#3a2b17] mb-3">ロードマップ</h2>
                <p className="text-slate-600 mb-8 flex-grow">
                  初心者から上級者まで、体系的に学びます。駒の動かし方、基本的な戦法、対局の流れを習得しましょう。
                </p>
                <div className="flex items-center text-amber-700 font-bold group-hover:gap-2 transition-all">
                  学習を始める <ArrowRight className="w-5 h-5 ml-1" />
                </div>
              </div>
            </Link>

            {/* Tsume Shogi Card */}
            <Link href="/learn/tsume" className="group relative">
              <div className="absolute inset-0 bg-indigo-200/20 rounded-3xl transform transition-transform group-hover:scale-105 group-hover:-rotate-1"></div>
              <div className="relative h-full bg-white rounded-3xl border border-black/5 shadow-xl p-8 flex flex-col items-center text-center transition-transform group-hover:-translate-y-1">
                <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-6 group-hover:bg-indigo-200 transition-colors">
                  <Trophy className="w-10 h-10 text-indigo-700" />
                </div>
                <h2 className="text-2xl font-bold text-[#3a2b17] mb-3">詰将棋</h2>
                <p className="text-slate-600 mb-8 flex-grow">
                  詰将棋を解いて終盤力を鍛えましょう。日替わり問題やランク別問題に挑戦できます。
                </p>
                <div className="flex items-center text-indigo-700 font-bold group-hover:gap-2 transition-all">
                  トレーニング開始 <ArrowRight className="w-5 h-5 ml-1" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
