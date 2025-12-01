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
    // ★修正: 2三の歩を 'p' (小文字=相手の歩) に変更
    sfen: "position sfen 7k1/9/7P1/9/9/9/9/9/9 b G 1",
    checkMove: (move) => {
      // 2二(x:7, y:1)に金を打てば正解
      return move.drop === true && move.to.x === 7 && move.to.y === 1;
    },
    successMessage: "正解！頭金（あたまきん）です。2三の歩が邪魔で、玉は逃げられません。"
  },
  {
    step: 2,
    title: "1手詰 第2問（不成）",
    description: "銀を2一に移動させて王手をかけましょう。ただし、普通に「成る」と金と同じ動きになり、斜め後ろに下がれないため王手が消えてしまいます。「成らない」を選んでください！",
    sfen: "position sfen 8l/6GSk/7Np/9/9/9/9/9/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      return move.from.x === 7 && move.from.y === 1 && move.to.x === 7 && move.to.y === 0 && move.piece === "S";
    },
    successMessage: "大正解！銀は成らないことで、斜め後ろへの効きを残せます。これを「銀の不成（ならず）」と言います。"
  },
  // ★修正: 第3問
  {
    step: 3,
    title: "1手詰 第3問（金の死角）",
    description: "相手の「金」の弱点を突く問題です。金は「斜め後ろ」には動けません。持ち駒の「銀」を、金に取られない場所に打って詰ませてください！",
    // ★修正: 不要な歩を消し、全体を1筋(右端)に寄せました
    // 1一玉(k), 1三金(g), 1四香(l)
    sfen: "position sfen 7k1/9/7G1/7L1/9/9/9/9/9 b S 1",
    checkMove: (move) => {
      // 2二(x:7, y:1)に銀を打てば正解
      // ※1筋に寄ったので、正解の場所も変わらず2二です
      return move.to.x === 7 && move.to.y === 1 && move.piece === "G";
    },
    successMessage: "お見事！金は斜め後ろ（2二）に下がれないため、この銀を取ることができません。"
  }
];


export const TSUME_2_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "1手詰・中盤 第1問",
    description: "持ち駒はありませんが、盤上の駒が協力して詰ませる形です。4四にいる「角」のライン（利き）が重要です。3三の「金」をどこに動かせば詰むでしょうか？",
    // 盤面: 2一玉(k), 1三銀(s), 3三金(G), 4四角(B)
    // 持ち駒なし (-)
    sfen: "position sfen 7k1/9/6G1S/5b3/9/9/9/9/9 b - 1",
    checkMove: (move) => {
      // 3三(x:6, y:2) にある金を 2二(x:7, y:1) に移動すれば正解
      // ※角の利きがあるので、玉は金を取れません
      if (!move.from) return false;
      return move.to.x === 7 && move.to.y === 1 && move.piece === "+S";
    },
    successMessage: "正解！角の紐（サポート）がついているので、相手は金を取ることができません。"
  },
  
  {
    step: 3,
    title: "1手詰・中盤 第3問",
    description: "盤上にある自分の「馬」を使って詰ませる問題です。邪魔な相手の駒を取り除きながら王手をかけてください！",
    sfen: "position sfen 7B+B/9/6pk1/7pp/9/9/9/9/9 b - 1",
    checkMove: (move) => {
      // 1一(x:8, y:0) の馬を 2一(x:7, y:0) に移動（角を取る）
      if (!move.from) return false;
      return (
        move.from.x === 8 && move.from.y === 0 && // 移動元: 1一
        move.to.x === 8 && move.to.y === 1 &&     // 移動先: 2一
        move.piece === "+B"                       // 駒: 馬
      );
    },
    successMessage: "正解！相手の角を取ることで、玉の逃げ道を完全に塞ぎました。"
  },

  {
    step: 3,
    title: "1手詰・中盤 第3問",
    description: "相手の守りは堅そうに見えますが、「角の頭（2二）」が弱点です！角は斜めにしか動けないため、目の前は守れていません。持ち駒の「金」を打って詰ませてください。",
    // 盤面:
    // 1段目: 7マス空き, 2一角(b), 1一玉(k) -> 7bk
    // 2段目: 9マス空き -> 9
    // 3段目: 7マス空き, 2三馬(+B・自), 1三桂(n) -> 7+Bn
    // 持ち駒: 金(G)
    sfen: "position sfen 6bk1/9/6+BN1/9/9/9/9/9/9 b G 1",
    checkMove: (move) => {
      // 2二(x:7, y:1) に金(G)を打てば正解
      return move.to.x === 8 && move.to.y === 0 && move.piece === "+N";
    },
    successMessage: "お見事！相手の角は頭（前）を守れないため、打った金を取れません。また、2三の馬が効いているので玉でも取れません。"
  }
];


// 詰将棋 (1手詰・実戦編)
export const TSUME_3_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "1手詰・実戦編 第1問",
    description: "3三にいる「飛車」を使って詰ませる問題です。このまま動かすだけでは逃げられてしまいますが、「成る（パワーアップ）」とどうなるでしょうか？",
    // 盤面:
    // 1一香(l)
    // 1二玉(k)
    // 1三歩(p), 2三歩(p), 3三飛(R) ※飛車は自分の駒
    sfen: "position sfen 8l/8k/6RPp/9/9/9/9/9/9 b - 1",
    checkMove: (move) => {
      // 3三(x:6, y:2) の飛車を 3二(x:6, y:1) に「成って」移動
      if (!move.from) return false;
      return (
        move.from.x === 6 && move.from.y === 2 && // 移動元: 3三
        move.to.x === 6 && move.to.y === 1 &&     // 移動先: 3二
        move.piece === "+R"                       // 駒: 龍(成った飛車)
      );
    },
    successMessage: "正解！飛車が「龍」に成ることで斜めにも動けるようになり、玉の逃げ道（2一）を塞ぐことができました。"
  },

  {
    step: 2,
    title: "1手詰・実戦編 第2問",
    description: "持ち駒の「飛車」を使って詰ませる問題です。近づけて打つと逃げられてしまいます。大駒は「離して打つ」のがコツです！",
    // 盤面:
    // 1段目: 4マス空き, 5一龍(+R・自), 4マス空き -> 4+R4
    // 2段目: 2マス空き, 7二玉(k), 6マス空き -> 2k6
    // 3段目: 3マス空き, 6三歩(p), 3マス空き, 2三歩(p), 1マス空き -> 3p3p1
    // 持ち駒: 飛(R)
    sfen: "position sfen 4+R4/6k2/4p1pp1/9/9/9/9/9/9 b R 1",
    checkMove: (move) => {
      // 4二(x:5, y:1) に飛車(R)を打てば正解
      // ※3二(x:6, y:1)だと4三に逃げられるため不正解
      return move.drop === true && move.to.x === 5 && move.to.y === 1 && move.piece === "R";
    },
    successMessage: "正解！4二に打つことで玉の逃げ道をなくせます。"
  }
];