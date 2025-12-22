import { Lesson } from "./types";

export const LESSONS: Lesson[] = [
  // --- 基本の駒の動き ---
  { id: "pawn", title: "基本の駒の動き（歩）", description: "まずは歩の動きを覚えましょう。将棋の基本となる駒です。", category: "basics", status: "available", order: 1 },
  { id: "lance", title: "基本の駒の動き（香車）", description: "前にどこまでも進める「槍」のような駒です。バックはできません。", category: "basics", status: "available", order: 2 },
  { id: "knight", title: "基本の駒の動き（桂馬）", description: "唯一、駒を飛び越えられるトリッキーな駒です。", category: "basics", status: "available", order: 3 },
  { id: "silver", title: "基本の駒の動き（銀）", description: "攻めの要となる駒。斜め後ろに下がれるのがポイントです。", category: "basics", status: "available", order: 4 },
  { id: "gold", title: "基本の駒の動き（金）", description: "守りの要。斜め後ろ以外、すべての方向に進めます。", category: "basics", status: "available", order: 5 },
  { id: "bishop", title: "基本の駒の動き（角）", description: "斜めにどこまでも進めます。成ると「馬」になります。", category: "basics", status: "available", order: 6 },
  { id: "rook", title: "基本の駒の動き（飛車）", description: "縦横にどこまでも進めます。成ると最強の「龍」に。", category: "basics", status: "available", order: 7 },
  { id: "king", title: "基本の駒の動き（王）", description: "取られたら負け。全方向に1マスずつ動けます。", category: "basics", status: "available", order: 8 },

  // --- 詰将棋 ---
  
  // 1手詰 (基本)
  {
    // ★ここを変更！ "001" ではなく "tsume1-001" にします
    id: "tsume1-001", 
    title: "1手詰：第1問",
    description: "王手をかけて相手の玉を詰ませる「詰将棋」の基本です。",
    category: "tsume-1",
    status: "available",
    order: 9,
  },

  // 1手詰 (中盤・連携)
  {
    // ★ここも変更！ "001" ではなく "tsume2-001" にします
    id: "tsume2-001",
    title: "1手詰・中盤：第1問",
    description: "盤上の駒を連携させて詰ませる練習です。",
    category: "tsume-2",
    status: "available",
    order: 10,
  },

  {
    // ★ここも変更！ "001" ではなく "tsume2-001" にします
    id: "tsume3-001",
    title: "1手詰・中盤：第1問",
    description: "盤上の駒を連携させて詰ませる練習です。",
    category: "tsume-3",
    status: "available",
    order: 11,
  },

  // --- ミニゲーム: 浮き駒キャプチャ ---
  {
    id: "uki-capture",
    title: "駒の効き：浮き駒を取る（60秒）",
    description: "浮き駒（守られていない駒）を素早く見つけて取る60秒タイムアタック。",
    category: "basics",
    status: "available",
    order: 999,
    stars: 1,
    href: "/training/uki-capture",
  },

  {
    id: "basics_pawn_0",
    title: "歩の動きと成り（復習）",
    description: "歩は前に1マス。敵陣で成る/不成、成りのタイミングを確認します。",
    category: "basics",
    status: "available",
    order: 12,
    href: "/training/basics/pawn",
    stars: 0,
    prerequisites: [],
  },

  {
    id: "basics_pawn_1_role",
    title: "歩の役割（壁・道を開ける・捨て駒・と金）",
    description:
      "歩は守りでは壁、攻めでは道を開ける。歩交換や捨て歩、と金の強さまで体験します。",
    category: "basics",
    status: "available",
    order: 2,
    href: "/training/basics/pawn/role",
    stars: 0,
    prerequisites: ["basics_pawn_0"],
  },

  {
    id: "basics_pawn_2_tarefu",
    title: "垂れ歩",
    description: "相手の1つ手前に歩を打ち、『次に成る』プレッシャーを作る手筋を体験します。",
    category: "basics",
    status: "available",
    order: 3,
    href: "/training/basics/pawn/tarefu",
    stars: 0,
    prerequisites: ["basics_pawn_1_role"],
  },

  {
    id: "basics_pawn_3_tsugifu",
    title: "継ぎ歩",
    description: "歩を取らせたあと、持ち歩を同じ筋に継いで圧力を続ける手筋を体験します。",
    category: "basics",
    status: "available",
    order: 4,
    href: "/training/basics/pawn/tsugifu",
    stars: 0,
    prerequisites: ["basics_pawn_2_tarefu"],
  },

];