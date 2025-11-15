"use client";
import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
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
          className={`px-2 py-1 rounded border text-sm ${handSel && handSel.side===side && handSel.piece===k ? 'bg-amber-100 border-amber-400' : 'bg-white'}`}
          onClick={() => onSelectHand(side, k)}
          disabled={(H[k]||0)===0 || turn!==side}
          title={`${side==='black'?'先手':'後手'}の持駒 ${k}`}
        >{k}:{H[k]||0}</button>
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
    const res = await fetch((process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787") + "/digest", {
      method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ usi })
    });
    const json = await res.json();
    alert((json.summary || []).join("\n"));
  }
  async function callAnnotate() {
    const usi = moves.length ? `startpos moves ${moves.join(" ")}` : "startpos";
    const res = await fetch((process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787") + "/annotate", {
      method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ usi, byoyomi_ms: 250 })
    });
    const json = await res.json();
    if (!res.ok) { alert("注釈失敗: " + JSON.stringify(json)); return; }
    type NoteView = { ply?: number; move?: string; delta_cp?: number | null };
    const notes: NoteView[] = Array.isArray(json.notes) ? json.notes : [];
    alert("要約:\n" + (json.summary || "") + "\n\n先頭3件:\n" + notes.slice(0,3).map((n)=>`${n.ply}. ${n.move} Δcp:${n.delta_cp??"?"}`).join("\n"));
  }

  return (
    <Card className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">ローカル対局（β）</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={undo} disabled={!moves.length}>一手戻す</Button>
          <Button variant="outline" onClick={resetAll}>リセット</Button>
          <label className="ml-2 text-sm inline-flex items-center gap-1">
            <input type="checkbox" checked={promote} onChange={(e)=>setPromote(e.target.checked)} /> 成り
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
        <div>
          <div className="mb-2 text-sm text-muted-foreground">手番: <span className="font-medium">{sideLabel}</span></div>
          <div onContextMenu={(e)=>e.preventDefault()} onClick={(e)=>{
            // クリック位置からマス計算: Boardは(10,10)開始+50ピクセルグリッド
            const svg = (e.target as HTMLElement).closest('svg');
            if (!svg) return;
            const rect = (svg as SVGSVGElement).getBoundingClientRect();
            const x = Math.floor(((e.clientX - rect.left) - 10) / 50);
            const y = Math.floor(((e.clientY - rect.top) - 10) / 50);
            if (x>=0 && x<9 && y>=0 && y<9) onBoardClick(x,y);
          }}>
            <Board pieces={pieces} bestmove={boardOverlay} />
          </div>
        </div>

        <div className="space-y-3 w-full md:w-64">
          <div>
            <div className="text-sm font-medium">先手 持駒</div>
            <HandView side="black" hands={hands} turn={turn} handSel={handSel} onSelectHand={selectHand} />
          </div>
          <div>
            <div className="text-sm font-medium">後手 持駒</div>
            <HandView side="white" hands={hands} turn={turn} handSel={handSel} onSelectHand={selectHand} />
          </div>
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">手順（USI）</div>
            <div className="font-mono text-xs bg-gray-50 rounded p-2 min-h-16">
              {moves.join(" ") || "—"}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" onClick={callDigest} disabled={!moves.length}>10秒ダイジェスト</Button>
              <Button onClick={callAnnotate} disabled={!moves.length}>注釈を生成</Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            注意: 現状は合法手判定を厳密には行いません（β版）。
          </div>
        </div>
      </div>
    </Card>
  );
}
