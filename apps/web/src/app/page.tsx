// apps/web/src/app/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-center text-2xl sm:text-3xl font-bold mb-6 text-amber-900">将棋指導AI（ホーム）</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex flex-col items-start">
          <h3 className="font-semibold mb-2">Play</h3>
          <p className="text-sm text-muted-foreground mb-4">単局面解析や実戦で練習します。</p>
          <Link href="/play"><Button>Play</Button></Link>
        </Card>

        <Card className="p-4 flex flex-col items-start">
          <h3 className="font-semibold mb-2">Learn</h3>
          <p className="text-sm text-muted-foreground mb-4">デイリー問題やレッスンに挑戦。</p>
          <Link href="/learn"><Button>Learn</Button></Link>
        </Card>

        <Card className="p-4 flex flex-col items-start">
          <h3 className="font-semibold mb-2">Annotate</h3>
          <p className="text-sm text-muted-foreground mb-4">棋譜注釈ツールを開きます。</p>
          <Link href="/annotate"><Button>Annotate</Button></Link>
        </Card>
      </div>
    </main>
  );
}
