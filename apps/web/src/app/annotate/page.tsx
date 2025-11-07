"use client";
import React from "react";
import AnnotateView from "@/components/AnnotateView";

export default function AnnotatePage() {
  return (
    <main className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">棋譜注釈</h1>
      <AnnotateView />
    </main>
  );
}
