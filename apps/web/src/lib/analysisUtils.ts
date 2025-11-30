import type { EngineAnalyzeResponse, EngineMultipvItem } from "@/lib/annotateHook";
import type { Side } from "@/lib/board";

export type AnalysisCache = Record<number, EngineAnalyzeResponse | undefined>;

export type EvalImpactCategory =
  | "good"       // 好手
  | "inaccuracy" // 疑問手
  | "mistake"    // 悪手
  | "blunder"    // 大悪手
  | "neutral"    // 普通
  | "unknown";

export type HighlightClassification = "good" | "inaccuracy" | "mistake" | "blunder";

const DIFF_LABEL = {
  waiting: "解析待ち",
} as const;

/**
 * 評価値オブジェクトから数値(cp)を取り出す
 * mateの場合は ±30000 に変換する
 */
export const extractCpScore = (item?: EngineMultipvItem): number | null => {
  if (!item) return null;
  
  // 詰みの場合
  if (item.score.type === "mate") {
    const mateVal = item.score.mate ?? 0;
    // 正なら先手勝ち(30000)、負なら後手勝ち(-30000)
    return mateVal >= 0 ? 30000 : -30000;
  }
  
  // 通常の評価値
  return typeof item.score.cp === "number" ? item.score.cp : null;
};

export const getPrimaryEvalScore = (payload?: EngineAnalyzeResponse): number | null => {
  if (!payload?.multipv?.length) return null;
  const bestItem = payload.multipv.find((pv) => pv.multipv === 1) ?? payload.multipv[0];
  return extractCpScore(bestItem);
};

export const classifyEvalImpact = (diff: number | null): EvalImpactCategory => {
  if (diff === null) return "unknown";
  // 判定基準 (cp単位)
  if (diff >= 200) return "good";       // 200点以上良くなった
  if (diff <= -600) return "blunder";   // 600点以上悪くなった
  if (diff <= -200) return "mistake";   // 200点以上悪くなった
  if (diff <= -80) return "inaccuracy"; // 80点以上悪くなった
  return "neutral";
};

export const formatDiffLabel = (diff: number | null): string => {
  if (diff === null) return DIFF_LABEL.waiting;
  const prefix = diff > 0 ? "+" : "";
  return `${prefix}${diff}`;
};

export const isHighlightClassification = (
  value: EvalImpactCategory,
): value is HighlightClassification => ["good", "inaccuracy", "mistake", "blunder"].includes(value);

export const getImpactDescriptor = (diff: number | null) => {
  const classification = classifyEvalImpact(diff);
  return {
    classification,
    diffLabel: formatDiffLabel(diff),
    highlight: isHighlightClassification(classification),
  };
};

export type MoveImpact = {
  ply: number;
  diff: number | null;
  classification: EvalImpactCategory;
};

/**
 * 評価値の推移を分析して、各手の良し悪しを判定する
 */
export const buildMoveImpacts = (
  analysisByPly: AnalysisCache,
  moveCount: number,
  initialTurn: Side = "b", // デフォルトは先手
): MoveImpact[] => {
  if (!moveCount) return [];

  const impacts: MoveImpact[] = [];
  
  // 0手目の評価値（基準）
  let prevSenteScore = 0;

  for (let i = 1; i <= moveCount; i++) {
    const response = analysisByPly[i];
    const rawScore = getPrimaryEvalScore(response);

    if (rawScore === null) {
      impacts.push({ ply: i, diff: null, classification: "unknown" });
      continue;
    }

    // 常に「先手(Sente)視点」に変換して計算する
    // 偶数手目(0,2,4...)完了時点の局面＝先手番＝そのまま
    // 奇数手目(1,3,5...)完了時点の局面＝後手番＝反転
    const isSenteView = (i % 2 === 0); 
    const currentSenteScore = rawScore * (isSenteView ? 1 : -1);

    // 変動幅 (先手視点での増減)
    const delta = currentSenteScore - prevSenteScore;

    // この手を指した人にとっての損得
    const moverIsSente = (i % 2 !== 0);
    const impact = moverIsSente ? delta : -delta;

    impacts.push({
      ply: i,
      diff: impact,
      classification: classifyEvalImpact(impact),
    });

    prevSenteScore = currentSenteScore;
  }

  return impacts;
};