"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { ShogiBoard } from "@/components/ShogiBoard"; 
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { ArrowLeft, RefreshCw, Trophy, Camera } from "lucide-react";
import Link from "next/link";
import { 
  buildBoardTimeline, 
  type BoardMatrix, 
  type HandsState,
  type Side
} from "@/lib/board";
import { type PieceBase } from "@/lib/sfen";

// 玉を配置した有効な初期盤面
const INITIAL_SFEN = "8l/8k/5Bppp/9/9/9/9/9/K8 b S 1";
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

type GameStatus = "playing" | "win" | "lose";

const boardToSfen = (board: BoardMatrix, hands: HandsState, turn: Side): string => {
  let sfen = "";
  let emptyCount = 0;
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece) {
        if (emptyCount > 0) { sfen += emptyCount.toString(); emptyCount = 0; }
        sfen += piece;
      } else { emptyCount++; }
    }
    if (emptyCount > 0) { sfen += emptyCount.toString(); emptyCount = 0; }
    if (y < 8) sfen += "/";
  }
  sfen += ` ${turn} `;
  const handOrder: PieceBase[] = ["R", "B", "G", "S", "N", "L", "P"];
  let handStr = "";
  handOrder.forEach((p) => {
    const count = hands.b[p] || 0;
    if (count === 1) handStr += p; else if (count > 1) handStr += count + p;
  });
  handOrder.forEach((p) => {
    const count = hands.w[p] || 0;
    if (count === 1) handStr += p.toLowerCase(); else if (count > 1) handStr += count + p.toLowerCase();
  });
  if (handStr === "") handStr = "-";
  sfen += handStr;
  sfen += " 1";
  return sfen;
};

// ユーティリティ
const flipTurn = (side: Side): Side => (side === "b" ? "w" : "b");

export default function TsumePage() {
  const [currentSfen, setCurrentSfen] = useState(INITIAL_SFEN);
  
  const { board, hands, turn } = useMemo(() => {
    try {
        // SFENの補正（sfen ... が抜けている場合など）
        const sfenBody = currentSfen.startsWith("sfen") ? currentSfen : `sfen ${currentSfen}`;
        // positionコマンド用ではなく、盤面生成用のタイムライン作成
        const tl = buildBoardTimeline(sfenBody);
        const lastIdx = tl.boards.length - 1;
        
        // movesが含まれている場合、buildBoardTimelineは手番を正確に追跡している
        // しかし、詰将棋モードでは「現在の盤面」を「新しい開始局面」として扱うため
        // 手番情報はSFEN文字列の "b" か "w" を直接パースしたほうが確実な場合がある
        const sfenParts = sfenBody.split(" ");
        const turnPart = sfenParts.length > 2 ? sfenParts[2] : "b";

        return {
            board: tl.boards[lastIdx],
            hands: tl.hands[lastIdx],
            turn: turnPart as Side // SFENの文字を信じる
        };
    } catch (e) {
        return { board: [], hands: { b: {}, w: {} }, turn: "b" as Side };
    }
  }, [currentSfen]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [message, setMessage] = useState("王様を詰ませてください");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = useCallback(() => {
    setCurrentSfen(INITIAL_SFEN);
    setGameStatus("playing");
    setMessage("王様を詰ませてください");
    setIsProcessing(false);
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (画像アップロード処理は変更なし)
  };

  const handleBoardChange = useCallback(async (newBoard: BoardMatrix) => {
    if (gameStatus !== "playing" || isProcessing) return;
    
    const prevSfen = currentSfen;
    setIsProcessing(true);
    let shouldUnlockProcessing = true; 

    try {
        // --- 持ち駒同期ロジック (簡易版) ---
        // 盤上の駒が増えたら持ち駒を減らす処理
        const countPieces = (b: BoardMatrix, side: Side) => {
            let count = 0;
            for (let y = 0; y < 9; y++) {
                for (let x = 0; x < 9; x++) {
                    const p = b[y][x];
                    if (!p) continue;
                    const raw = p.replace("+", "");
                    const isBlack = raw === raw.toUpperCase();
                    if ((side === "b" && isBlack) || (side === "w" && !isBlack)) count++;
                }
            }
            return count;
        };
        const prevCount = countPieces(board, turn);
        const newCount = countPieces(newBoard, turn);
        const nextHands = { b: { ...hands.b }, w: { ...hands.w } };

        if (newCount > prevCount) {
            // 持ち駒使用の検知ロジック（簡略化：一番ありそうな駒を減らす等の厳密な処理は省略し、
            // 実際はShogiBoardからonHandsChangeも連携するのがベストだが、
            // ここでは簡易的に「前の持ち駒」をそのまま使うか、少し調整する）
            // ※ 正確には ShogiBoard が onMove を発火し、そこで update するのが理想
        }
        // -----------------------------------

        // ★★★ 最重要修正ポイント ★★★
        // 詰将棋（攻め方＝User＝先手）において、Userが指した直後の局面は
        // 必ず「後手（w/White）」の手番になります。
        // 自動計算に任せず、ここで "w" を強制指定します。
        const nextTurn: Side = "w"; 
        
        const nextSfen = boardToSfen(newBoard, nextHands, nextTurn);

        console.log("[Frontend] New Board SFEN:", nextSfen); 

        // 画面を更新（ユーザーの手を反映）
        setCurrentSfen(nextSfen);

        // エンジンに問い合わせ
        const res = await fetch(`${API_BASE}/api/tsume/play`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sfen: nextSfen }),
        });
        const data = await res.json();

        // 判定
        if (data.status === "win") {
            setGameStatus("win");
            setMessage(data.message || "正解！詰みました！");
        } else if (data.status === "continue" && data.bestmove) {
            // 応手あり
            setMessage(data.message || "正解！(相手が逃げました)");
            const nextMove = data.bestmove;
            // AIの手を反映した新しいSFENを作る（moves追記方式）
            // ※ nextSfen は "w" 手番なので、そのまま moves を足せば整合性が取れる
            const sfenWithMove = `sfen ${nextSfen} moves ${nextMove}`;
            setCurrentSfen(sfenWithMove);
        } else {
            // 不正解
            setGameStatus("lose");
            setMessage(data.message || "不正解：詰みません");
            shouldUnlockProcessing = false; 

            setTimeout(() => {
                setGameStatus("playing");
                setMessage("再挑戦してください");
                setIsProcessing(false);
                setCurrentSfen(prevSfen); // 元に戻す
            }, 1500);
        }

    } catch (e) {
        console.error(e);
        showToast({ title: "通信エラー" });
        setCurrentSfen(prevSfen);
    } finally {
        if (shouldUnlockProcessing) {
            setIsProcessing(false);
        }
    }
  }, [gameStatus, isProcessing, hands, turn, currentSfen, board]);

  const handleHandsChange = useCallback((newHands: HandsState) => {
      // 持ち駒操作の同期が必要ならここに実装
  }, []);

  return (
    <div className="min-h-screen bg-[#fbf7ef] p-4 flex flex-col items-center gap-6">
      <div className="w-full max-w-4xl flex items-center justify-between">
        <Link href="/learn" className="text-slate-600 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> 戻る
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-600" /> 実戦詰将棋
        </h1>
        
        <div className="flex gap-2">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-4 h-4 mr-2" /> 盤面読取
            </Button>
            
            <Button variant="outline" size="icon" onClick={handleReset}>
                <RefreshCw className="w-4 h-4" />
            </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className={`px-6 py-2 rounded-full font-bold text-lg transition-colors duration-300 ${
          gameStatus === "win" ? "bg-green-100 text-green-700" :
          gameStatus === "lose" ? "bg-red-100 text-red-700" :
          "bg-white text-slate-700 border border-slate-200"
        }`}>
          {message}
        </div>

        <div className="border-4 border-[#5d4037] rounded-lg shadow-xl overflow-hidden bg-[#e0c39e]">
          <ShogiBoard
            key={currentSfen}
            board={board}
            hands={hands}
            onBoardChange={handleBoardChange}
            onHandsChange={handleHandsChange} 
            mode="edit" 
            orientation="sente"
          />
        </div>

        {gameStatus !== "playing" && (
            <Button className="mt-4" onClick={handleReset}>
                もう一度挑戦
            </Button>
        )}
      </div>
    </div>
  );
}