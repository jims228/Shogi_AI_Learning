export type TrainingStep = {
  step: number;
  title: string;
  description: string;
  sfen: string;
  checkMove: (move: { 
    from?: { x: number, y: number }; 
    to: { x: number, y: number }; 
    piece: string; 
    drop?: boolean 
  }) => boolean;
  successMessage: string;
};

// 1. 歩
export const PAWN_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "歩兵（ふひょう）の動き",
    description: "「歩」は前に1マスだけ進めます。目の前の歩を1つ進めてみましょう。（ドラッグ＆ドロップで操作）",
    sfen: "9/9/9/9/9/9/2P6/9/9 b - 1",
    checkMove: (move) => {
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
      if (!move.from) return false;
      return move.from.x === 2 && move.from.y === 6 && move.to.x === 2 && move.to.y === 5;
    },
    successMessage: "ナイス！相手の駒を取ると、自分の「持ち駒」になります。"
  }
];

// 2. 香車
export const LANCE_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "香車（きょうしゃ）の動き",
    description: "「香車」は前にどこまでも進めますが、バックはできません。別名「槍（やり）」。一気に敵陣まで進んでみましょう！",
    sfen: "position sfen 9/9/9/9/9/9/9/1L7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const isForward = move.from.x === 1 && move.from.y === 7 && move.to.x === 1 && move.to.y < 7;
      return isForward;
    },
    successMessage: "ナイス！香車は障害物がない限り、どこまでも直進できます。"
  },
  {
    step: 2,
    title: "香車で取る",
    description: "前にある敵の駒を取ってみましょう。途中に他の駒があると飛び越えられないので注意です。",
    sfen: "position sfen 9/9/1p7/9/9/9/9/1L7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      return move.from.x === 1 && move.from.y === 7 && move.to.x === 1 && move.to.y === 2;
    },
    successMessage: "お見事！遠くの駒も一瞬で取れるのが香車の強みです。"
  }
];

// 3. 桂馬
export const KNIGHT_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "桂馬（けいま）の動き",
    description: "桂馬は特殊な動きをします。前に2つ、横に1つ、「Yの字」にジャンプします。目の前の歩を飛び越えて進んでみましょう！",
    sfen: "position sfen 9/9/9/9/9/9/9/1P7/1N7 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === 2 && dx === 1;
    },
    successMessage: "素晴らしい！桂馬だけが他の駒を飛び越えることができます。"
  },
  {
    step: 2,
    title: "桂馬の両取り",
    description: "桂馬は同時に2つの場所を狙えます。うまく跳ねて、相手の「金」を取ってみましょう。",
    sfen: "position sfen 9/9/9/9/9/9/g1g6/9/1N7 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === 2 && dx === 1;
    },
    successMessage: "ナイス！「ふんどしの桂」と呼ばれる強力な手筋です。"
  }
];

// 4. 銀
export const SILVER_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "銀（ぎん）の動き",
    description: "銀は「前」と「斜め後ろ」に進めます（横と後ろには行けません）。千鳥足（ちどりあし）のように斜めに進んでみましょう。",
    sfen: "position sfen 9/9/9/9/9/9/4S4/9/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      const isForward = dy === 1 && dx === 0;
      const isDiagonalFront = dy === 1 && dx === 1;
      const isDiagonalBack = dy === -1 && dx === 1;
      return isForward || isDiagonalFront || isDiagonalBack;
    },
    successMessage: "その通り！銀は攻めにも守りにも使われる万能選手です。"
  },
  {
    step: 2,
    title: "銀で下がる",
    description: "銀は「斜め後ろ」に下がれるのが特徴です。相手の歩が前から来ました。斜め後ろに逃げてください！",
    sfen: "position sfen 9/9/9/9/4p4/4S4/9/9/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === -1 && dx === 1;
    },
    successMessage: "素晴らしい。引くことも重要な戦術です（銀は「千鳥に使う」と言います）。"
  }
];

// 5. 金
export const GOLD_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "金（きん）の動き",
    description: "金は「斜め後ろ」以外、すべての方向に1マス進めます。守りの要（かなめ）となる駒です。前か横に進んでみましょう。",
    sfen: "position sfen 9/9/9/9/9/9/9/4G4/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      const isDiagonalBack = dy === -1 && dx === 1;
      const isOneStep = Math.abs(dy) <= 1 && dx <= 1 && !(dy === 0 && dx === 0);
      return isOneStep && !isDiagonalBack;
    },
    successMessage: "その通り！金は王様を守るガードマンとして優秀です。"
  },
  {
    step: 2,
    title: "頭金（あたまきん）",
    description: "王様は「頭（前）」が弱点です。持ち駒の金を、相手の玉の頭（5二）に打って詰ませてください！5三の歩が支えになっています。",
    sfen: "position sfen 4k4/9/4P4/9/9/9/9/9/9 b G 1",
    checkMove: (move) => {
      return move.drop === true && move.to.x === 4 && move.to.y === 1;
    },
    successMessage: "お見事！これが必殺の「頭金」です。相手は金を取れません（取ると歩に取り返されるため）。"
  }
];

// 6. 角
export const BISHOP_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "角（かく）の動き",
    description: "角は斜めにどこまでも進めます。一気に盤面の反対側まで移動してみましょう。",
    sfen: "position sfen 9/9/9/9/9/9/9/1B7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = Math.abs(move.from.y - move.to.y);
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === dx && dy >= 2;
    },
    successMessage: "ナイス！角道（かくみち）を通すと、遠くから敵を狙えます。"
  },
  {
    step: 2,
    title: "角が成る（馬）",
    description: "角が敵陣（奥の3段）に入ると「馬（うま）」にパワーアップ（成る）できます。敵陣に入って成ってください。",
    sfen: "position sfen 9/9/9/9/9/9/9/1B7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      return move.to.y <= 2;
    },
    successMessage: "進化完了！馬は「角の動き＋王様の動き（上下左右1マス）」ができる最強格の駒です。"
  }
];

// 7. 飛車
export const ROOK_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "飛車（ひしゃ）の動き",
    description: "飛車は縦横にどこまでも進めます。将棋で最も攻める力が強い駒です。一気に前に進んでみましょう。",
    sfen: "position sfen 9/9/9/9/9/9/9/1R7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      return dx === 0 && dy >= 2;
    },
    successMessage: "素晴らしい！この突破力が飛車の武器です。"
  },
  {
    step: 2,
    title: "飛車が成る（龍）",
    description: "飛車も敵陣に入ると「龍（りゅう）」に成れます。敵陣に入って成ってみましょう！",
    sfen: "position sfen 9/9/9/9/9/9/9/1R7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      return move.to.y <= 2;
    },
    successMessage: "最強駒「龍」の誕生です！龍は「飛車の動き＋王様の動き（斜め1マス）」ができます。"
  }
];

// 8. 王将
export const KING_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "王将（玉）の動き",
    description: "王様（玉）は全方向に1マスずつ動けます。取られたら負けなので、逃げる練習をしましょう。上へ逃げてください。",
    sfen: "position sfen 9/9/9/9/9/9/9/4K4/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      return move.to.y < 7;
    },
    successMessage: "OKです！常に安全な場所へ逃げることが重要です。"
  }
];

// 詰将棋 (1手詰)
export const TSUME_1_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "1手詰 第1問",
    description: "相手の玉は「2一」にいます。「2三」には相手の歩がいて、逃げ道をふさいでくれています。持ち駒の「金」を使って、一撃で詰ませてください！",
    sfen: "position sfen 7k1/9/7p1/9/9/9/9/9/9 b G 1",
    checkMove: (move) => {
      return move.drop === true && move.to.x === 7 && move.to.y === 1;
    },
    successMessage: "正解！頭金（あたまきん）です。2三の歩が邪魔で、玉は逃げられません。"
  },
  // ★追加: 第2問（銀の不成）
  {
    step: 2,
    title: "1手詰 第2問（不成）",
    description: "銀を2一に移動させて王手をかけましょう。ただし、普通に「成る」と金と同じ動きになり、斜め後ろに下がれないため王手が消えてしまいます。「成らない」を選んでください！",
    sfen: "position sfen 8l/6GSk/7Np/9/9/9/9/9/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      // 2二(x:7, y:1) から 2一(x:7, y:0) へ移動
      // move.piece === "S" (成っていない銀) であることを確認
      return move.from.x === 7 && move.from.y === 1 && move.to.x === 7 && move.to.y === 0 && move.piece === "S";
    },
    successMessage: "大正解！銀は成らないことで、斜め後ろへの効きを残せます。これを「銀の不成（ならず）」と言います。"
  }
];