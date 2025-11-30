import { Lesson } from "./types";

export const LESSONS: Lesson[] = [
  {
    // ★ここを変更しました：作ったページのパス (basics/pawn) に合わせる
    id: "pawn",
    title: "基本の駒の動き",
    description: "まずは歩の動きを覚えましょう。将棋の基本となる駒です。",
    category: "basics", 
    status: "available",
    order: 1,
  },
  {
    id: "piece_move_basic_2",
    title: "3手番の基礎",
    description: "相手の駒を取ったり、成ったりする動きを学びます。",
    category: "piece-move",
    status: "available",
    order: 2,
  },
  {
    id: "tsume_1_001",
    title: "一手詰み・序盤",
    description: "王手をかけて相手の玉を詰ませる「詰将棋」の基本です。",
    category: "tsume-1",
    status: "locked",
    order: 3,
    // IDが変わったので、ここも合わせる必要があります
    prerequisites: ["pawn"], 
  },
  {
    id: "tsume_1_002",
    title: "一手詰み・中盤",
    description: "少し複雑な形の一手詰みに挑戦しましょう。",
    category: "tsume-1",
    status: "locked",
    order: 4,
    prerequisites: ["tsume_1_001"],
  },
];