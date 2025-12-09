"use client";

import React from "react";
import Link from "next/link";
import { Bell, UserCircle, ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TsumePage() {
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
        <div className="mx-auto max-w-2xl px-4 text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center">
              <Construction className="w-12 h-12 text-indigo-600" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-[#3a2b17] mb-4">
            Tsume Shogi Coming Soon
          </h1>
          
          <p className="text-slate-600 text-lg mb-8 leading-relaxed">
            We are currently building a comprehensive collection of checkmate puzzles.
            Check back soon for daily challenges and ranked practice modes!
          </p>

          <Link href="/learn">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Courses
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
