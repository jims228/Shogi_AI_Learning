import type { EngineAnalyzeResponse, EngineMultipvItem } from "@/lib/annotateHook";
import type { Side } from "@/lib/board";

export type AnalysisCache = Record<number, EngineAnalyzeResponse | undefined>;

export type EvalImpactCategory =
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "neutral"
  | "unknown";

export type HighlightClassification = "good" | "inaccuracy" | "mistake" | "blunder";

const flipSide = (side: Side): Side => (side === "b" ? "w" : "b");

const DIFF_LABEL = {
  waiting: "解析待ち",
} as const;

export const extractCpScore = (item?: EngineMultipvItem): number | null => {
  if (!item) return null;
  if (item.score.type !== "cp") return null;
  return typeof item.score.cp === "number" ? item.score.cp : null;
};

export const getPrimaryEvalScore = (payload?: EngineAnalyzeResponse): number | null => {
  if (!payload?.multipv?.length) return null;
  const bestItem = payload.multipv.find((pv) => pv.multipv === 1) ?? payload.multipv[0];
  return extractCpScore(bestItem);
};

export const classifyEvalImpact = (diff: number | null): EvalImpactCategory => {
  if (diff === null) return "unknown";
  if (diff >= 150) return "good";
  if (diff <= -1000) return "blunder";
  if (diff <= -400) return "mistake";
  if (diff <= -150) return "inaccuracy";
  return "neutral";
};

export const formatDiffLabel = (diff: number | null): string => {
  if (diff === null) return DIFF_LABEL.waiting;
  const prefix = diff > 0 ? "+" : "";
  return `${prefix}${diff}cp`;
};

export const isHighlightClassification = (
  value: EvalImpactCategory,
): value is HighlightClassification => value === "good" || value === "inaccuracy" || value === "mistake" || value === "blunder";

export const getImpactDescriptor = (diff: number | null) => {
  const classification = classifyEvalImpact(diff);
  return {
    classification,
    diffLabel: formatDiffLabel(diff),
    highlight: isHighlightClassification(classification),
  };
};

const toMoverPerspective = (cp: number | null, mover: Side): number | null => {
  if (cp === null) return null;
  const multiplier = mover === "b" ? 1 : -1;
  return cp * multiplier;
};

const getMoverForIndex = (initialTurn: Side, moveIndex: number): Side =>
  moveIndex % 2 === 0 ? initialTurn : flipSide(initialTurn);

export type MoveImpact = {
  ply: number;
  diff: number | null;
  classification: EvalImpactCategory;
};

export const buildMoveImpacts = (
  analysisByPly: AnalysisCache,
  moveCount: number,
  initialTurn: Side,
): MoveImpact[] => {
  if (!moveCount) return [];
  return Array.from({ length: moveCount }, (_, index) => {
    const mover = getMoverForIndex(initialTurn, index);
    const prevScore = getPrimaryEvalScore(analysisByPly[index]);
    const nextScore = getPrimaryEvalScore(analysisByPly[index + 1]);
    const prevPov = toMoverPerspective(prevScore, mover);
    const nextPov = toMoverPerspective(nextScore, mover);
    const diff = prevPov !== null && nextPov !== null ? nextPov - prevPov : null;
    const classification = classifyEvalImpact(diff);
    return {
      ply: index + 1,
      diff,
      classification,
    };
  });
};
