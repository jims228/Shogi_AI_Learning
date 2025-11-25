"use client";
import React, { useState, useEffect } from "react";
import { ProgressProvider, useProgress } from "@/lib/learn/progress";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InteractiveTsumeBoard } from "@/components/learn/InteractiveTsumeBoard";
import { loadTsumeDaily, type Puzzle } from "@/lib/learn/tsume";
import { AlertCircle, CheckCircle, Lightbulb } from "lucide-react";

function TsumeLessonInner() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const { addXp, loseHeart, markCleared } = useProgress();

  useEffect(() => {
    loadTsumeDaily(10).then(setPuzzles).catch(() => setPuzzles([]));
  }, []);

  const cur = puzzles[index];

  if (!cur) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">問題を読み込み中...</p>
      </Card>
    );
  }

  const handleMoveSubmit = (move: string) => {
    // 解答候補の抽出
    const solRaw = cur.solution || "";
    let candidates: string[] = [];
    if (solRaw.includes(";")) {
      candidates = solRaw.split(/;+\s*/).map(s => s.trim()).filter(Boolean);
    } else {
      const firstMove = solRaw.split(/\s+/).filter(Boolean)[0];
      if (firstMove) candidates = [firstMove];
    }

    // 正解判定
    const normalizedMove = move.toLowerCase().replace(/\s+/g, "");
    const isCorrect = candidates.some(c => {
      const normalizedCandidate = c.toLowerCase().replace(/\s+/g, "");
      return normalizedCandidate === normalizedMove;
    });

    if (isCorrect) {
      setResult("correct");
      addXp(20);
      markCleared(cur.id);
      setShowExplanation(true);
    } else {
      setResult("wrong");
      loseHeart();
    }
  };

  const handleNext = () => {
    if (index + 1 < puzzles.length) {
      setIndex(index + 1);
      setResult(null);
      setShowHint(false);
      setShowExplanation(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setShowHint(false);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">問題 {index + 1} / {puzzles.length}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              目標: {cur.goal}
            </p>
            {cur.difficulty && (
              <p className="text-xs text-muted-foreground">
                難易度: {"★".repeat(cur.difficulty)}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHint(!showHint)}
          >
            <Lightbulb className="w-4 h-4 mr-1 text-[#555]" />
            ヒント
          </Button>
        </div>

        {showHint && cur.hint && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              💡 ヒント: {cur.hint}
            </p>
          </div>
        )}
      </Card>

      {/* 盤面 */}
      <Card className="p-6">
        <InteractiveTsumeBoard
          sfen={cur.sfen}
          turn={cur.turn as "w" | "b"}
          onMoveSubmit={handleMoveSubmit}
          disabled={result !== null}
        />
      </Card>

      {/* 結果表示 */}
      {result === "correct" && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-[#555] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-green-900">正解です！ 🎉</h3>
              <p className="text-sm text-green-800 mt-1">
                素晴らしい！この手で詰みです。
              </p>
            </div>
          </div>

          {showExplanation && (
            <div className="mt-4 p-3 bg-white rounded border border-green-200">
              <h4 className="font-semibold text-sm mb-2">📚 解説</h4>
              <p className="text-sm text-gray-700">
                {getExplanation(cur)}
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {index + 1 < puzzles.length && (
              <Button onClick={handleNext}>次の問題へ</Button>
            )}
            {index + 1 >= puzzles.length && (
              <Button onClick={() => window.location.href = "/learn"}>
                学習ハブに戻る
              </Button>
            )}
          </div>
        </Card>
      )}

      {result === "wrong" && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-[#555] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-900">もう一度考えてみましょう</h3>
              <p className="text-sm text-red-800 mt-1">
                この手では詰みません。別の手を試してみてください。
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={handleRetry}>
              もう一度挑戦
            </Button>
            <Button variant="ghost" onClick={handleNext}>
              スキップ
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function getExplanation(puzzle: Puzzle): string {
  // 簡易的な解説生成（実際はpuzzleデータに含めることを推奨）
  if (puzzle.solution.includes("G*")) {
    return "この形は「頭金」と呼ばれる基本的な詰み形です。玉の頭（真上）に金を打つことで、玉は逃げ場を失い詰みとなります。金は斜め後ろ以外の8方向に利いており、玉の逃げ道を完全に塞ぐことができます。";
  }
  if (puzzle.solution.includes("S*")) {
    return "銀を使った詰み形です。銀は斜め前と真後ろに利くため、玉を追い詰めるのに有効です。周囲の駒との連携により詰みが成立しています。";
  }
  return `正解手は「${puzzle.solution}」です。この手により玉は逃げ場を失い、次に取られる手もないため詰みとなります。詰将棋では、相手玉を詰ますために最短手順を見つけることが重要です。`;
}

export default function TsumePage() {
  return (
    <ProgressProvider>
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">詰将棋</h1>
        <p className="text-muted-foreground mb-6">
          駒を動かして相手の玉を詰ませましょう
        </p>
        <TsumeLessonInner />
      </main>
    </ProgressProvider>
  );
}
