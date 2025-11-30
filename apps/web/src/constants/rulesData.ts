// src/constants/rulesData.ts

export type TrainingStep = {
  step: number;
  title: string;
  description: string;
  sfen: string;
  // ここで ShogiBoard から来るデータの型に合わせます
  checkMove: (move: { 
    from?: { x: number, y: number }; 
    to: { x: number, y: number }; 
    piece: string; 
    drop?: boolean 
  }) => boolean;
  successMessage: string;
};

export const PAWN_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "歩兵（ふひょう）の動き",
    description: "「歩」は前に1マスだけ進めます。目の前の歩を1つ進めてみましょう。（ドラッグ＆ドロップで操作）",
    sfen: "9/9/9/9/9/9/2P6/9/9 b - 1",
    checkMove: (move) => {
      // 7七(x:2, y:6) から 7六(x:2, y:5) への移動なら正解
      // move.from が undefined でないことを確認
      if (!move.from) return false;
      return move.from.x === 2 && move.from.y === 6 && move.to.x === 2 && move.to.y === 5;
    },
    successMessage: "素晴らしい！歩は一歩ずつ着実に進みます。"
  },
  {
    step: 2,
    title: "相手の駒を取る",
    description: "歩は進む先に相手の駒があれば、取ることができます。目の前の「と金」を取ってみましょう。",
    sfen: "9/9/9/9/9/2+p6/2P6/9/9 b - 1",
    checkMove: (move) => {
      // 7七(x:2, y:6) から 7六(x:2, y:5) への移動なら正解
      if (!move.from) return false;
      return move.from.x === 2 && move.from.y === 6 && move.to.x === 2 && move.to.y === 5;
    },
    successMessage: "ナイス！相手の駒を取ると、自分の「持ち駒」になります。"
  }
];