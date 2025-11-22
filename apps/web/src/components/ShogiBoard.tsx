import React from "react";
import { PieceSprite } from "./PieceSprite";
import type { Placed } from "@/lib/sfen";

interface ShogiBoardProps {
  pieces: Placed[];
  bestmove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  lastMove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  onCellClick?: (x: number, y: number) => void;
  flipped?: boolean; // 盤面反転（後手番視点など）
}

const FILES = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
const RANKS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const CELL_SIZE = 50; // マス目のサイズ
const BOARD_PADDING = 20;

export const ShogiBoard: React.FC<ShogiBoardProps> = ({ 
  pieces, 
  bestmove, 
  lastMove, 
  onCellClick,
  flipped = false 
}) => {
  // 盤面の描画サイズ
  const boardSize = CELL_SIZE * 9;

  // 座標変換ヘルパー
  const getDisplayPos = (x: number, y: number) => {
    if (flipped) {
      return { x: (8 - x), y: (8 - y) };
    }
    return { x, y };
  };

  return (
    <div className="relative select-none" style={{ width: boardSize + BOARD_PADDING * 2, height: boardSize + BOARD_PADDING * 2 }}>
      {/* 盤面背景 (木目調イメージの代わりにCSSグラデーション) */}
      <div 
        className="absolute inset-0 rounded-lg shadow-2xl border-4 border-[#5d4037]"
        style={{ 
          background: "linear-gradient(135deg, #eecfa1 0%, #d4a373 100%)",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.5)"
        }}
      />

      {/* 盤面グリッドとコンテンツ */}
      <div 
        className="absolute"
        style={{ left: BOARD_PADDING, top: BOARD_PADDING, width: boardSize, height: boardSize }}
      >
        {/* グリッド線 */}
        <svg width={boardSize} height={boardSize} className="absolute inset-0 pointer-events-none z-0">
          {/* 縦線 */}
          {[...Array(10)].map((_, i) => (
            <line 
              key={`v-${i}`} 
              x1={i * CELL_SIZE} y1={0} 
              x2={i * CELL_SIZE} y2={boardSize} 
              stroke="#5d4037" 
              strokeWidth={i === 0 || i === 9 ? 2 : 1} 
            />
          ))}
          {/* 横線 */}
          {[...Array(10)].map((_, i) => (
            <line 
              key={`h-${i}`} 
              x1={0} y1={i * CELL_SIZE} 
              x2={boardSize} y2={i * CELL_SIZE} 
              stroke="#5d4037" 
              strokeWidth={i === 0 || i === 9 ? 2 : 1} 
            />
          ))}
          {/* 星 (3,3), (3,6), (6,3), (6,6) -> インデックスは 2, 6 */}
          {[2, 6].map(y => [2, 6].map(x => (
            <circle 
              key={`star-${x}-${y}`} 
              cx={x * CELL_SIZE + CELL_SIZE / 2}
              cy={y * CELL_SIZE + CELL_SIZE / 2}
              r={3} 
              fill="#5d4037" 
            />
          )))}
        </svg>

        {/* マス目 (クリック判定用 & ハイライト) */}
        <div className="absolute inset-0 grid grid-cols-9 grid-rows-9 z-10">
          {[...Array(81)].map((_, i) => {
            const x = i % 9;
            const y = Math.floor(i / 9);
            // 表示座標への変換
            const display = getDisplayPos(x, y);
            
            // ラストムーブのハイライト
            const isLastMoveFrom = lastMove && lastMove.from.x === x && lastMove.from.y === y;
            const isLastMoveTo = lastMove && lastMove.to.x === x && lastMove.to.y === y;
            
            // ベストムーブのハイライト (矢印の代わりに背景色で控えめに)
            const isBestMoveFrom = bestmove && bestmove.from.x === x && bestmove.from.y === y;
            const isBestMoveTo = bestmove && bestmove.to.x === x && bestmove.to.y === y;

            return (
              <div
                key={`${x}-${y}`}
                className="relative"
                style={{
                  gridColumnStart: display.x + 1,
                  gridRowStart: display.y + 1,
                  backgroundColor: isLastMoveTo ? "rgba(255, 165, 0, 0.3)" : 
                                   isLastMoveFrom ? "rgba(255, 165, 0, 0.15)" : 
                                   isBestMoveTo ? "rgba(0, 255, 0, 0.1)" :
                                   "transparent"
                }}
                onClick={() => onCellClick?.(x, y)}
              />
            );
          })}
        </div>

        {/* 駒の描画 */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {pieces.map((p, i) => {
            const display = getDisplayPos(p.x, p.y);
            return (
              <PieceSprite 
                key={`${i}-${p.x}-${p.y}`} 
                piece={p.piece} 
                x={display.x} 
                y={display.y} 
                size={CELL_SIZE} 
              />
            );
          })}
        </div>

        {/* ベストムーブ矢印 (SVGオーバーレイ) */}
        {bestmove && (
          <svg width={boardSize} height={boardSize} className="absolute inset-0 pointer-events-none z-30">
            <Arrow 
              x1={getDisplayPos(bestmove.from.x, bestmove.from.y).x * CELL_SIZE + CELL_SIZE/2}
              y1={getDisplayPos(bestmove.from.x, bestmove.from.y).y * CELL_SIZE + CELL_SIZE/2}
              x2={getDisplayPos(bestmove.to.x, bestmove.to.y).x * CELL_SIZE + CELL_SIZE/2}
              y2={getDisplayPos(bestmove.to.x, bestmove.to.y).y * CELL_SIZE + CELL_SIZE/2}
            />
          </svg>
        )}
      </div>

      {/* 座標ラベル */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {/* 筋 (9..1) */}
        {FILES.map((f, i) => {
          const idx = flipped ? 8 - i : i;
          return (
            <div 
              key={`file-${i}`} 
              className="absolute text-xs font-bold text-[#5d4037]"
              style={{ 
                left: BOARD_PADDING + idx * CELL_SIZE, 
                top: 2, 
                width: CELL_SIZE, 
                textAlign: "center" 
              }}
            >
              {f}
            </div>
          );
        })}
        {/* 段 (一..九) */}
        {RANKS.map((r, i) => {
          const idx = flipped ? 8 - i : i;
          return (
            <div 
              key={`rank-${i}`} 
              className="absolute text-xs font-bold text-[#5d4037]"
              style={{ 
                right: 2, 
                top: BOARD_PADDING + idx * CELL_SIZE, 
                height: CELL_SIZE, 
                lineHeight: `${CELL_SIZE}px` 
              }}
            >
              {r}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Arrow: React.FC<{x1:number;y1:number;x2:number;y2:number}> = ({ x1,y1,x2,y2 }) => {
  // 矢印の描画ロジック
  // 始点と終点が同じ場合は描画しない
  if (x1 === x2 && y1 === y2) return null;
  
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  // 矢印の長さ調整（駒に被りすぎないように）
  const shortLen = Math.max(0, len - 20);
  
  // 実際の描画始点・終点
  const sx = x1 + Math.cos(angle) * 10;
  const sy = y1 + Math.sin(angle) * 10;
  const ex = x1 + Math.cos(angle) * (len - 10);
  const ey = y1 + Math.sin(angle) * (len - 10);

  return (
    <g>
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#22c55e" strokeWidth="4" strokeOpacity="0.6" strokeLinecap="round" />
      <polygon 
        points={`${ex},${ey} ${ex - 10 * Math.cos(angle - Math.PI/6)},${ey - 10 * Math.sin(angle - Math.PI/6)} ${ex - 10 * Math.cos(angle + Math.PI/6)},${ey - 10 * Math.sin(angle + Math.PI/6)}`} 
        fill="#22c55e" 
        fillOpacity="0.8" 
      />
    </g>
  );
};
