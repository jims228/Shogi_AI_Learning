import React from "react";
import { motion } from "framer-motion";
import type { PieceCode } from "@/lib/sfen";

// 駒の画像サイズとオフセット設定
// 仮定: 横一列または2列に並んでいる。
// ここでは一般的な「K, R, B, G, S, N, L, P, +R, +B, +S, +N, +L, +P」の順序を仮定します。
// 画像全体のサイズや配置に合わせて調整が必要かもしれません。
// ユーザー提供の画像: /images/pieces.png

const PIECE_W = 43; // 元画像の1駒の幅(推定)
const PIECE_H = 48; // 元画像の1駒の高さ(推定)

// 駒の種類からインデックスへのマッピング
const PIECE_INDEX: Record<string, number> = {
  "K": 0, // 玉
  "R": 1, // 飛
  "B": 2, // 角
  "G": 3, // 金
  "S": 4, // 銀
  "N": 5, // 桂
  "L": 6, // 香
  "P": 7, // 歩
  "+R": 8, // 竜
  "+B": 9, // 馬
  "+S": 10, // 成銀
  "+N": 11, // 成桂
  "+L": 12, // 成香
  "+P": 13, // と
};

interface PieceSpriteProps {
  piece: PieceCode;
  x: number; // 0-8 (9筋-1筋)
  y: number; // 0-8 (一段-九段)
  size?: number; // 表示サイズ
}

export const PieceSprite: React.FC<PieceSpriteProps> = ({ piece, x, y, size = 46 }) => {
  // 先手(Sente)は大文字、後手(Gote)は小文字
  // 先手はそのまま、後手は180度回転
  const isPromoted = piece.startsWith("+");
  const baseChar = isPromoted ? piece[1] : piece[0];
  const isSente = baseChar === baseChar.toUpperCase();
  const key = (isPromoted ? "+" : "") + baseChar.toUpperCase();
  
  const index = PIECE_INDEX[key] ?? 7; // デフォルトは歩
  
  // 背景画像の位置計算
  // 横一列に並んでいると仮定
  const bgX = -index * PIECE_W;
  const bgY = 0;

  // 座標計算 (将棋盤は右上原点ではなく、左上が9一、右下が1九...いや、
  // 配列上は x=0 が9筋、x=8 が1筋。 y=0 が一段、y=8 が九段。
  // 描画位置は x * cell_size, y * cell_size)
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "absolute",
        left: x * size + (size - PIECE_W) / 2 + 2, // 中央寄せ調整
        top: y * size + (size - PIECE_H) / 2,
        width: PIECE_W,
        height: PIECE_H,
        backgroundImage: "url(/images/pieces.png)",
        backgroundPosition: `${bgX}px ${bgY}px`,
        backgroundRepeat: "no-repeat",
        transform: isSente ? "none" : "rotate(180deg)",
        zIndex: 10,
        pointerEvents: "none", // クリックは盤面に通す
      }}
    />
  );
};
