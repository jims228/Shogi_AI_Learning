"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProgress, ProgressProvider } from "@/lib/learn/progress";
import XPBar from "@/components/learn/XPBar";
import StreakBar from "@/components/learn/StreakBar";
import HeartsBadge from "@/components/learn/HeartsBadge";
import Link from "next/link";

function HubInner() {
  const { state } = useProgress();
  const stages = ["move-basics", "terms", "tsume", "hisshi", "openings", "nextmove"];
  return (
    <div>
      <div className="flex gap-4 items-center mb-4">
        <XPBar value={state.xp} max={1000} />
        <StreakBar value={state.streak} />
        <HeartsBadge value={state.hearts} max={5} />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {stages.map((s) => (
          <Link key={s} href={`/learn/${s}`}>
            <Card className="p-3 text-center hover:shadow-md cursor-pointer">{s}</Card>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <Card className="p-4">
          <h3 className="font-semibold">Daily Puzzle</h3>
          <p className="text-sm text-muted-foreground">Try the tsume daily or explore other lessons.</p>
          <div className="mt-3">
            <Link href="/learn/tsume-daily"><Button>Start Tsume Daily</Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LearnPage() {
  return (
    <ProgressProvider>
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Learn Hub</h1>
        <HubInner />
      </main>
    </ProgressProvider>
  );
}
