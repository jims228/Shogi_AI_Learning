"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Board } from "@/components/Board";
import type { Placed, PieceCode } from "@/lib/sfen";
import { sfenToPlaced } from "@/lib/sfen";

type Side = "black" | "white";
type Hand = Record<"P"|"L"|"N"|"S"|"G"|"B"|"R", number>;
type PieceBase = keyof Hand;

const START_BOARD: Placed[] = sfenToPlaced("startpos");

function clonePieces(p: Placed[]): Placed[] { return p.map(x => ({ piece: x.piece, x: x.x, y: x.y })); }
function isBlackPiece(pc: PieceCode): boolean { return pc[0] === "+" ? pc[1] === pc[1].toUpperCase() : pc === (pc as string).toUpperCase(); }
function demotePieceBase(code: PieceCode): PieceBase | null {
  const c = code.startsWith("+") ? code[1] : code[0];
  const up = c.toUpperCase();
  if ((["P","L","N","S","G","B","R"] as const).includes(up as PieceBase)) return up as PieceBase;
  if (up === "K") return null; // 王は持ち駒にならない
  return null;
}
function coordsToUsi(x: number, y: number): string { const file = 9 - x; const rank = String.fromCharCode("a".charCodeAt(0) + y); return `${file}${rank}`; }
function canPromoteBase(b: string): boolean { return ["P","L","N","S","B","R"].includes(b.toUpperCase()); }
// function inPromoZone(side: Side, y: number): boolean { return side === "black" ? y <= 2 : y >= 6; }

type BestmoveOverlay = { from: {x:number;y:number}; to: {x:number;y:number} } | null;

type HandViewProps = {
  side: Side;
  hands: { black: Hand; white: Hand };
  turn: Side;
  handSel: { side: Side; piece: keyof Hand } | null;
  onSelectHand: (side: Side, piece: keyof Hand) => void;
};

function HandView({ side, hands, turn, handSel, onSelectHand }: HandViewProps) {
  const H = hands[side];
  const order: (keyof Hand)[] = ["R","B","G","S","N","L","P"];
  return (
    <div className="flex flex-wrap gap-2">
      {order.map(k => (
        <button key={k}
          className={`
            px-3 py-2 rounded-lg border text-sm font-bold transition-all
            ${handSel && handSel.side===side && handSel.piece===k 
              ? 'bg-shogi-gold text-black border-shogi-gold shadow-lg scale-105' 
              : 'bg-black/20 border-white/10 text-slate-300 hover:bg-white/10'}
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
          onClick={() => onSelectHand(side, k)}
          disabled={(H[k]||0)===0 || turn!==side}
          title={`${side==='black'?'先手':'後手'}の持駒 ${k}`}
        >
          <span className="mr-1">{k}</span>
          <span className="text-xs opacity-70">x{H[k]||0}</span>
        </button>
      ))}
    </div>
  );
}

export default function LocalPlay() {
  const [pieces, setPieces] = useState<Placed[]>(() => clonePieces(START_BOARD));
  const [turn, setTurn] = useState<Side>("black");
  const [hands, setHands] = useState<{black: Hand; white: Hand}>(() => ({ black: {P:0,L:0,N:0,S:0,G:0,B:0,R:0}, white: {P:0,L:0,N:0,S:0,G:0,B:0,R:0} }));
  const [moves, setMoves] = useState<string[]>([]);
  const [fromSel, setFromSel] = useState<{x:number;y:number}|null>(null);
  const [handSel, setHandSel] = useState<{side:Side; piece: keyof Hand} | null>(null);
  const [promote, setPromote] = useState(false);

  const sideLabel = turn === "black" ? "先手" : "後手";

  function resetAll() {
    setPieces(clonePieces(START_BOARD));
    setHands({ black: {P:0,L:0,N:0,S:0,G:0,B:0,R:0}, white: {P:0,L:0,N:0,S:0,G:0,B:0,R:0} });
    setMoves([]); setFromSel(null); setHandSel(null); setPromote(false); setTurn("black");
  }

  function rebuildFromMoves(seq: string[]) {
    // 極簡易実装: 自前状態を初期化して、順に適用（合法性チェックしない）
    let pcs = clonePieces(START_BOARD);
    const h: {black: Hand; white: Hand} = { black: {P:0,L:0,N:0,S:0,G:0,B:0,R:0}, white: {P:0,L:0,N:0,S:0,G:0,B:0,R:0} };
    let side: Side = "black";
    const at = (x:number,y:number) => pcs.find(p => p.x===x && p.y===y);
    for (const mv of seq) {
      if (mv.includes("*")) {
        // drop: "P*7f"
        const pieceBase = mv[0] as keyof Hand;
        const fx = 9 - Number(mv[2]);
        const fy = mv.charCodeAt(3) - "a".charCodeAt(0);
        // 手持ちから減らし、盤面に置く
        const sideKey = side === "black" ? "black":"white";
        if (h[sideKey][pieceBase] > 0) h[sideKey][pieceBase] -= 1;
        pcs = pcs.filter(p => !(p.x===fx && p.y===fy));
        const code = side === "black" ? pieceBase : (pieceBase.toLowerCase() as PieceCode);
        pcs.push({ piece: code as PieceCode, x: fx, y: fy });
      } else {
        // normal move "7g7f" or with '+' (ignored for coord)
        const fx = 9 - Number(mv[0]);
        const fy = mv.charCodeAt(1) - "a".charCodeAt(0);
        const tx = 9 - Number(mv[2]);
        const ty = mv.charCodeAt(3) - "a".charCodeAt(0);
        const src = at(fx, fy);
        if (!src) { side = side === "black" ? "white" : "black"; continue; }
        // capture (remove dst, add to hand demoted)
        const dst = at(tx, ty);
        if (dst) {
          const base = demotePieceBase(dst.piece);
          if (base) {
            const captSide = side === "black" ? "black" : "white";
            h[captSide][base] += 1;
          }
          pcs = pcs.filter(p => !(p.x===tx && p.y===ty));
        }
        // move
        const prom = mv.length >= 5 && mv[4] === "+";
        const moved = pcs.find(p => p===src)!;
        moved.x = tx; moved.y = ty;
        if (prom) {
          const up = (moved.piece.startsWith("+") ? moved.piece[1] : moved.piece[0]).toUpperCase();
          if (canPromoteBase(up)) {
            moved.piece = (isBlackPiece(moved.piece) ? ("+"+up) : ("+"+up.toLowerCase())) as PieceCode;
          }
        }
      }
      side = side === "black" ? "white" : "black";
    }
    setPieces(clonePieces(pcs));
    setHands(h);
    setTurn(side);
  }

  function onBoardClick(x: number, y: number) {
    // Hand drop
    if (handSel) {
      const destPiece = pieces.find(p => p.x===x && p.y===y);
      if (destPiece) { setHandSel(null); return; }
      const mv = `${handSel.piece}*${coordsToUsi(x,y)}`;
      const seq = [...moves, mv];
      setMoves(seq); setHandSel(null); setFromSel(null); setPromote(false);
      rebuildFromMoves(seq);
      return;
    }
    // Select or move
    if (!fromSel) {
      const p = pieces.find(pp => pp.x===x && pp.y===y);
      if (!p) return;
      const black = isBlackPiece(p.piece);
      if ((turn === "black" && !black) || (turn === "white" && black)) return;
      setFromSel({x,y});
      return;
    } else {
      const mv = `${coordsToUsi(fromSel.x, fromSel.y)}${coordsToUsi(x,y)}${promote?"+":""}`;
      const seq = [...moves, mv];
      setMoves(seq); setFromSel(null); setPromote(false);
      rebuildFromMoves(seq);
    }
  }

  function selectHand(side: Side, piece: keyof Hand) {
    if (turn !== side) return;
    if ((hands[side][piece]||0) <= 0) return;
    setFromSel(null);
    setHandSel({ side, piece });
  }

  function undo() {
    if (!moves.length) return;
    const seq = moves.slice(0, -1);
    setMoves(seq);
    setFromSel(null); setHandSel(null); setPromote(false);
    rebuildFromMoves(seq);
  }

  const boardOverlay = useMemo<BestmoveOverlay>(() => {
    if (!fromSel) return null;
    return { from: {x: fromSel.x, y: fromSel.y}, to: {x: fromSel.x, y: fromSel.y} };
  }, [fromSel]);

  async function callDigest() {
    const usi = moves.length ? `startpos moves ${moves.join(" ")}` : "startpos";
    const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_ENGINE_URL || process.env.ENGINE_URL || "http://localhost:8787";
    const url = `${API_BASE}/digest`;
    // eslint-disable-next-line no-console
    console.log("[web] localplay digest fetch to:", url);
    try {
      const res = await fetch(url, {
        method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ usi })
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[web] localplay digest error: ${url} status=${res.status} body=${errText}`);
        alert("ダイジェストAPIエラー: " + errText);
        return;
      }
      const json = await res.json();
      alert((json.summary || []).join("\n"));
    } catch (e) {
      alert("ダイジェストAPI通信エラー: " + String(e));
    }
  }
  async function callAnnotate() {
    const usi = moves.length ? `startpos moves ${moves.join(" ")}` : "startpos";
    const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_ENGINE_URL || process.env.ENGINE_URL || "http://localhost:8787";
    const url = `${API_BASE}/annotate`;
    // eslint-disable-next-line no-console
    console.log("[web] localplay annotate fetch to:", url);
    try {
      const res = await fetch(url, {
        method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ usi, byoyomi_ms: 500 })
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[web] localplay annotate error: ${url} status=${res.status} body=${errText}`);
        alert("注釈APIエラー: " + errText);
        return;
      }
      const json = await res.json();
      type NoteView = { ply?: number; move?: string; delta_cp?: number | null };
      const notes: NoteView[] = Array.isArray(json.notes) ? json.notes : [];
      alert("要約:\n" + (json.summary || "") + "\n\n先頭3件:\n" + notes.slice(0,3).map((n)=>`${n.ply}. ${n.move} Δcp:${n.delta_cp??"?"}`).join("\n"));
    } catch (e) {
      alert("注釈API通信エラー: " + String(e));
    }
  }

  return (
    <div className="bg-shogi-panel rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
          ローカル対局（β）
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={undo} disabled={!moves.length} className="bg-transparent border-white/20 text-slate-300 hover:bg-white/10 hover:text-white">
            一手戻す
          </Button>
          <Button variant="outline" onClick={resetAll} className="bg-transparent border-white/20 text-slate-300 hover:bg-white/10 hover:text-white">
            リセット
          </Button>
          <label className="ml-2 text-sm inline-flex items-center gap-2 text-slate-300 cursor-pointer bg-black/20 px-3 py-2 rounded-lg hover:bg-black/30 transition-colors">
            <input 
              type="checkbox" 
              checked={promote} 
              onChange={(e)=>setPromote(e.target.checked)} 
              className="w-4 h-4 rounded border-slate-500 text-shogi-gold focus:ring-shogi-gold bg-transparent"
            /> 
            <span>成り</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="flex flex-col items-center">
          <div className="mb-4 text-sm text-slate-400 bg-black/20 px-4 py-1 rounded-full">
            手番: <span className={`font-bold ${turn === "black" ? "text-white" : "text-slate-300"}`}>{sideLabel}</span>
          </div>
          
          {/* Board Wrapper */}
          <div 
            className="relative p-1 rounded-xl bg-gradient-to-br from-amber-800 to-amber-900 shadow-2xl"
            onContextMenu={(e)=>e.preventDefault()} 
            onClick={(e)=>{
              const svg = (e.target as HTMLElement).closest('svg');
              if (!svg) return;
              const rect = (svg as SVGSVGElement).getBoundingClientRect();
              const x = Math.floor(((e.clientX - rect.left) - 10) / 50);
              const y = Math.floor(((e.clientY - rect.top) - 10) / 50);
              if (x>=0 && x<9 && y>=0 && y<9) onBoardClick(x,y);
            }}
          >
            <Board pieces={pieces} bestmove={boardOverlay} />
          </div>
        </div>

        <div className="space-y-6 w-full">
          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">先手 (Black)</div>
            <HandView side="black" hands={hands} turn={turn} handSel={handSel} onSelectHand={selectHand} />
          </div>
          
          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">後手 (White)</div>
            <HandView side="white" hands={hands} turn={turn} handSel={handSel} onSelectHand={selectHand} />
          </div>

          <div className="pt-4 border-t border-white/5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Game Log (USI)</div>
            <div className="font-mono text-xs text-slate-300 bg-black/40 rounded-xl p-4 min-h-[100px] max-h-[200px] overflow-y-auto border border-white/5 leading-relaxed break-all">
              {moves.join(" ") || <span className="text-slate-600 italic">No moves yet...</span>}
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button 
                variant="secondary" 
                onClick={callDigest} 
                disabled={!moves.length}
                className="bg-blue-600 hover:bg-blue-500 text-white border-none"
              >
                10秒ダイジェスト
              </Button>
              <Button 
                onClick={callAnnotate} 
                disabled={!moves.length}
                className="bg-shogi-pink hover:bg-rose-500 text-white border-none"
              >
                注釈を生成
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-slate-600 text-center">
            注意: 現状は合法手判定を厳密には行いません（β版）。
          </div>
        </div>
      </div>
    </div>
  );
}
