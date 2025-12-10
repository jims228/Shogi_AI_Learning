"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lock, Star, Trophy, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// --- データ定義 ---
type Stage = {
  id: string;
  title: string;
  description: string;
  status: "completed" | "current" | "locked";
};

const ROADMAP_DATA: Stage[] = [
  { id: "1", title: "駒の動かし方", description: "歩、香車、桂馬...", status: "completed" },
  { id: "2", title: "成りのルール", description: "敵陣に入るとパワーアップ", status: "completed" },
  { id: "3", title: "反則手", description: "二歩、打ち歩詰め", status: "current" },
  { id: "4", title: "詰みの基本", description: "頭金、尻金", status: "locked" },
  { id: "5", title: "守りの囲い", description: "美濃囲い、矢倉", status: "locked" },
  { id: "6", title: "攻めの手筋", description: "垂れ歩、叩きの歩", status: "locked" },
  { id: "7", title: "棒銀戦法", description: "居飛車の基本", status: "locked" },
  { id: "8", title: "中飛車戦法", description: "振り飛車の基本", status: "locked" },
  { id: "9", title: "実戦対局 10級", description: "AIと対局しよう", status: "locked" },
  { id: "10", title: "三手詰め", description: "少し難しい詰将棋", status: "locked" },
  { id: "11", title: "初段への道", description: "卒業試験", status: "locked" },
];

// --- レイアウト定数 ---
const ITEM_WIDTH = 180;  // 各アイテムの幅
const ITEM_HEIGHT = 100; // 各アイテムの高さエリア
const X_GAP = 60;        // 横の間隔
const Y_GAP = 120;       // 縦の間隔
const ITEMS_PER_ROW = 4; // 1行あたりの個数

export default function RoadmapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1000);

  // ウィンドウサイズ監視 (レスポンシブ対応)
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    window.addEventListener("resize", updateWidth);
    updateWidth();
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // スマホかどうか判定 (幅が狭いときは縦一列にする)
  const isMobile = containerWidth < 600;

  // --- 座標計算ロジック ---
  const layout = useMemo(() => {
    // モバイル時は計算不要 (単純なリスト表示にするため)
    if (isMobile) return [];

    const items = ROADMAP_DATA.map((stage, index) => {
      const row = Math.floor(index / ITEMS_PER_ROW);
      const colIndex = index % ITEMS_PER_ROW;
      
      // 偶数行は左→右、奇数行は右→左 (ジグザグ)
      const isReverseRow = row % 2 !== 0;
      const col = isReverseRow ? (ITEMS_PER_ROW - 1 - colIndex) : colIndex;

      // 全体の中央に寄せるためのオフセット計算
      const totalRowWidth = (ITEMS_PER_ROW * ITEM_WIDTH) + ((ITEMS_PER_ROW - 1) * X_GAP);
      const startX = (containerWidth - totalRowWidth) / 2 + (ITEM_WIDTH / 2);
      
      const x = startX + col * (ITEM_WIDTH + X_GAP);
      const y = 80 + row * (ITEM_HEIGHT + Y_GAP); // 上部に少し余白

      return { ...stage, x, y, row, col, isReverseRow };
    });

    return items;
  }, [containerWidth, isMobile]);

  // --- SVGパス生成ロジック ---
  const svgPath = useMemo(() => {
    if (isMobile || layout.length === 0) return "";

    let path = `M ${layout[0].x} ${layout[0].y}`;

    for (let i = 0; i < layout.length - 1; i++) {
      const curr = layout[i];
      const next = layout[i + 1];

      // 同じ行なら直線を引く
      if (curr.row === next.row) {
        path += ` L ${next.x} ${next.y}`;
      } else {
        // 次の行へ移るカーブ (S字フックのような曲線)
        // 現在地から真下へ少し進み、そこから次の地点へカーブさせる
        const midY = (curr.y + next.y) / 2;
        // 制御点コントロール: 
        // 右端での折り返しなら右側に膨らむ、左端なら左側に膨らむ
        const controlX = curr.col === (ITEMS_PER_ROW - 1) 
          ? curr.x + 80 // 右へ膨らむ
          : curr.x - 80; // 左へ膨らむ

        // ベジェ曲線 (Q = 2次ベジェ, C = 3次ベジェ)
        // ここではシンプルに C を使って滑らかにつなぐ
        path += ` C ${controlX} ${curr.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
      }
    }
    return path;
  }, [layout, isMobile]);

  // 全体の高さ計算
  const totalHeight = isMobile 
    ? "auto" 
    : (layout.length > 0 ? layout[layout.length - 1].y + 150 : 800);

  return (
    <div className="min-h-screen bg-[#f6f1e6] text-[#2b2b2b] overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f9f3e5]/95 border-b border-black/10 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center">
          <Link href="/learn" className="flex items-center text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="font-bold">メニューに戻る</span>
          </Link>
          <h1 className="ml-6 text-xl font-bold text-[#3a2b17]">将棋学習ロードマップ</h1>
        </div>
      </header>

      <main className="pt-24 pb-20 px-4" ref={containerRef}>
        
        {/* === Desktop / Tablet View (蛇行レイアウト) === */}
        {!isMobile && (
          <div className="relative w-full mx-auto max-w-5xl" style={{ height: totalHeight }}>
            {/* SVG Path Background */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
              {/* パスの影（太い線） */}
              <path 
                d={svgPath} 
                fill="none" 
                stroke="#e2d5c3" 
                strokeWidth="16" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              {/* パスの芯（点線など装飾用） */}
              <path 
                d={svgPath} 
                fill="none" 
                stroke="#c0a080" 
                strokeWidth="3" 
                strokeDasharray="8 8" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="opacity-50"
              />
            </svg>

            {/* Nodes */}
            {layout.map((item, i) => (
              <div
                key={item.id}
                className="absolute z-10 flex flex-col items-center justify-center w-[180px]"
                style={{ 
                  left: item.x, 
                  top: item.y,
                  transform: "translate(-50%, -50%)" // 中心合わせ
                }}
              >
                {/* Node Icon Circle */}
                <div 
                  className={cn(
                    "w-16 h-16 rounded-full border-4 flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer bg-white relative",
                    item.status === "completed" ? "border-emerald-500 text-emerald-600" :
                    item.status === "current" ? "border-amber-500 text-amber-600 animate-pulse-slow ring-4 ring-amber-200" :
                    "border-slate-300 text-slate-300 bg-slate-50"
                  )}
                >
                  {item.status === "completed" && <Check className="w-8 h-8 stroke-[3]" />}
                  {item.status === "current" && <Star className="w-8 h-8 fill-current" />}
                  {item.status === "locked" && <Lock className="w-6 h-6" />}
                  
                  {/* ステージ番号バッジ */}
                  <div className={cn(
                    "absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                    item.status === "completed" ? "bg-emerald-500 text-white border-white" :
                    item.status === "current" ? "bg-amber-500 text-white border-white" :
                    "bg-slate-300 text-slate-500 border-white"
                  )}>
                    {i + 1}
                  </div>
                </div>

                {/* Text Label */}
                <div className="mt-3 text-center bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-black/5 shadow-sm">
                  <h3 className={cn("font-bold text-sm leading-tight", item.status === "locked" ? "text-slate-400" : "text-slate-800")}>
                    {item.title}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}

            {/* Start / Goal Decoration */}
            <div className="absolute font-bold text-slate-400 text-4xl opacity-20 pointer-events-none" style={{ left: layout[0]?.x - 120, top: layout[0]?.y - 20 }}>
              START
            </div>
          </div>
        )}

        {/* === Mobile View (縦一列レイアウト) === */}
        {isMobile && (
          <div className="flex flex-col gap-8 max-w-sm mx-auto relative">
            {/* 縦の接続線 */}
            <div className="absolute left-8 top-8 bottom-8 w-1 bg-slate-200 -z-10"></div>

            {ROADMAP_DATA.map((item, i) => (
              <div key={item.id} className="flex items-center gap-4">
                {/* Node */}
                <div className="relative shrink-0">
                  <div 
                    className={cn(
                      "w-16 h-16 rounded-full border-4 flex items-center justify-center shadow-md bg-white z-10 relative",
                      item.status === "completed" ? "border-emerald-500 text-emerald-600" :
                      item.status === "current" ? "border-amber-500 text-amber-600 ring-4 ring-amber-100" :
                      "border-slate-300 text-slate-300 bg-slate-50"
                    )}
                  >
                    {item.status === "completed" && <Check className="w-8 h-8 stroke-[3]" />}
                    {item.status === "current" && <Star className="w-8 h-8 fill-current" />}
                    {item.status === "locked" && <Lock className="w-6 h-6" />}
                  </div>
                </div>

                {/* Card */}
                <div className={cn(
                  "flex-1 p-4 rounded-xl border shadow-sm bg-white transition-all active:scale-95",
                  item.status === "current" ? "border-amber-400 shadow-md" : "border-slate-200"
                )}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", 
                      item.status === "current" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                    )}>
                      STAGE {i + 1}
                    </span>
                  </div>
                  <h3 className={cn("font-bold text-lg", item.status === "locked" ? "text-slate-400" : "text-slate-800")}>
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
