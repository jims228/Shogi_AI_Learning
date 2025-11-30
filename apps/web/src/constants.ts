import { Lesson } from "./types";

export const LESSONS: Lesson[] = [
  // 1. 歩
  {
    id: "pawn",
    title: "基本の駒の動き（歩）",
    description: "まずは歩の動きを覚えましょう。将棋の基本となる駒です。",
    category: "basics",
    status: "available",
    order: 1,
  },
  // 2. 香車
  {
    id: "lance",
    title: "基本の駒の動き（香車）",
    description: "前にどこまでも進める「槍」のような駒です。バックはできません。",
    category: "basics",
    status: "available",
    order: 2,
  },
  // 3. 桂馬
  {
    id: "knight",
    title: "基本の駒の動き（桂馬）",
    description: "唯一、駒を飛び越えられるトリッキーな駒です。",
    category: "basics",
    status: "available",
    order: 3,
  },
  // 4. 銀
  {
    id: "silver",
    title: "基本の駒の動き（銀）",
    description: "攻めの要となる駒。斜め後ろに下がれるのがポイントです。",
    category: "basics",
    status: "available",
    order: 4,
  },
  // 5. 金
  {
    id: "gold",
    title: "基本の駒の動き（金）",
    description: "守りの要。斜め後ろ以外、すべての方向に進めます。",
    category: "basics",
    status: "available",
    order: 5,
  },
  // 6. 角
  {
    id: "bishop",
    title: "基本の駒の動き（角）",
    description: "斜めにどこまでも進めます。成ると「馬」になります。",
    category: "basics",
    status: "available",
    order: 6,
  },
  // 7. 飛車
  {
    id: "rook",
    title: "基本の駒の動き（飛車）",
    description: "縦横にどこまでも進めます。成ると最強の「龍」に。",
    category: "basics",
    status: "available",
    order: 7,
  },
  // 8. 王
  {
    id: "king",
    title: "基本の駒の動き（王）",
    description: "取られたら負け。全方向に1マスずつ動けます。",
    category: "basics",
    status: "available",
    order: 8,
  },

  // 以下、ロックコンテンツなど（必要に応じて）
  {
    id: "001",
    title: "1手詰：第1問",
    description: "王手をかけて相手の玉を詰ませる「詰将棋」の基本です。",
    category: "tsume-1",
    status: "available",
    order: 5,
    prerequisites: ["silver"],
  },
];