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
    sfen: "position sfen 9/9/9/9/9/9/2P6/9/9 b - 1",
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
    sfen: "position sfen 9/9/9/9/9/2+p6/2P6/9/9 b - 1",
    checkMove: (move) => {
      // 7七(x:2, y:6) から 7六(x:2, y:5) への移動なら正解
      if (!move.from) return false;
      return move.from.x === 2 && move.from.y === 6 && move.to.x === 2 && move.to.y === 5;
    },
    successMessage: "ナイス！相手の駒を取ると、自分の「持ち駒」になります。"
  }
];

export const LANCE_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "香車（きょうしゃ）の動き",
    description: "「香車」は前にどこまでも進めますが、バックはできません。別名「槍（やり）」。一気に敵陣まで進んでみましょう！",
    // 盤面: 2八に香車、2二に敵の歩
    sfen: "position sfen 9/9/9/9/9/9/9/1L7/9 b - 1",
    checkMove: (move) => {
      // 8八(x:1, y:7) から 8四(x:1, y:3) など、前方への移動ならOKとします
      // ここではシンプルに「前に2マス以上進んだら正解」にしてみましょう
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
    // 盤面: 2八に香車、2三に敵の歩
    sfen: "position sfen 9/9/1p7/9/9/9/9/1L7/9 b - 1",
    checkMove: (move) => {
      // 8八から8三(x:1, y:2)にある歩を取る
      if (!move.from) return false;
      return move.from.x === 1 && move.from.y === 7 && move.to.x === 1 && move.to.y === 2;
    },
    successMessage: "お見事！遠くの駒も一瞬で取れるのが香車の強みです。"
  }
];

// 3. 桂馬（けいま）
export const KNIGHT_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "桂馬（けいま）の動き",
    description: "桂馬は特殊な動きをします。前に2つ、横に1つ、「Yの字」にジャンプします。目の前の歩を飛び越えて進んでみましょう！",
    // 盤面: 8九に桂馬、8八に味方の歩（障害物）
    sfen: "position sfen 9/9/9/9/9/9/9/1P7/1N7 b - 1",
    checkMove: (move) => {
      // 8九(x:1, y:8) から 7七(x:2, y:6) または 9七(x:0, y:6) への移動
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === 2 && dx === 1; // 前に2、横に1
    },
    successMessage: "素晴らしい！桂馬だけが他の駒を飛び越えることができます。"
  },
  {
    step: 2,
    title: "桂馬の両取り",
    description: "桂馬は同時に2つの場所を狙えます。うまく跳ねて、相手の「金」を取ってみましょう。",
    // ★修正箇所: G1G6 (味方) → g1g6 (敵) に変更
    sfen: "position sfen 9/9/9/9/9/9/g1g6/9/1N7 b - 1",
    checkMove: (move) => {
      // 左右どちらかの金を取ればOK
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === 2 && dx === 1;
    },
    successMessage: "ナイス！「ふんどしの桂」と呼ばれる強力な手筋です。"
  }
];

// 4. 銀（ぎん）
export const SILVER_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "銀（ぎん）の動き",
    description: "銀は「前」と「斜め後ろ」に進めます（横と後ろには行けません）。千鳥足（ちどりあし）のように斜めに進んでみましょう。",
    // 盤面: 5七に銀
    sfen: "position sfen 9/9/9/9/9/9/4S4/9/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y; // +なら前進、-なら後退
      const dx = Math.abs(move.from.x - move.to.x);
      
      // 前(dy=1, dx=0) または 斜め前(dy=1, dx=1) または 斜め後ろ(dy=-1, dx=1)
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
    // 盤面: 5五に銀、5四に敵の歩
    sfen: "position sfen 9/9/9/9/4p4/4S4/9/9/9 b - 1",
    checkMove: (move) => {
      // 斜め後ろに下がる
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === -1 && dx === 1; // 後ろへ1、横へ1
    },
    successMessage: "素晴らしい。引くことも重要な戦術です（銀は「千鳥に使う」と言います）。"
  }
];

// 5. 金（きん）
export const GOLD_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "金（きん）の動き",
    description: "金は「斜め後ろ」以外、すべての方向に1マス進めます。守りの要（かなめ）となる駒です。前か横に進んでみましょう。",
    // 盤面: 5八に金
    sfen: "position sfen 9/9/9/9/9/9/9/4G4/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      
      // 斜め後ろ(dy=-1, dx=1)以外ならOK
      const isDiagonalBack = dy === -1 && dx === 1;
      // 距離は1マスだけ
      const isOneStep = Math.abs(dy) <= 1 && dx <= 1 && !(dy === 0 && dx === 0);
      
      return isOneStep && !isDiagonalBack;
    },
    successMessage: "その通り！金は王様を守るガードマンとして優秀です。"
  },
  {
    step: 2,
    title: "頭金（あたまきん）",
    description: "王様は「頭（前）」が弱点です。持ち駒の金を、相手の玉の頭（5二）に打って詰ませてください！5三の歩が支えになっています。",
    // ★修正: 玉を5一(4k4)に配置、5三に歩(4P4)を配置して支えにする
    sfen: "position sfen 4k4/9/4P4/9/9/9/9/9/9 b G 1",
    checkMove: (move) => {
      // 5二(x:4, y:1)に打てば正解
      return move.drop === true && move.to.x === 4 && move.to.y === 1;
    },
    successMessage: "お見事！これが必殺の「頭金」です。相手は金を取れません（取ると歩に取り返されるため）。"
  }
];

// 6. 角（かく）
export const BISHOP_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "角（かく）の動き",
    description: "角は斜めにどこまでも進めます。一気に盤面の反対側まで移動してみましょう。",
    // 盤面: 8八に角
    sfen: "position sfen 9/9/9/9/9/9/9/1B7/9 b - 1",
    checkMove: (move) => {
      // 8八(x:1, y:7) から斜めに大きく移動 (2マス以上)
      if (!move.from) return false;
      const dy = Math.abs(move.from.y - move.to.y);
      const dx = Math.abs(move.from.x - move.to.x);
      return dy === dx && dy >= 2; // 斜めかつ2マス以上
    },
    successMessage: "ナイス！角道（かくみち）を通すと、遠くから敵を狙えます。"
  },
  {
    step: 2,
    title: "角が成る（馬）",
    description: "角が敵陣（奥の3段）に入ると「馬（うま）」にパワーアップ（成る）できます。敵陣に入って成ってください。",
    // 盤面: 8八に角
    sfen: "position sfen 9/9/9/9/9/9/9/1B7/9 b - 1",
    checkMove: (move) => {
      // 2二(x:7, y:1)などに移動して成ればOK
      // move.piece が "+B" (馬) になっていれば成ったと判定できますが、
      // 簡易的に座標と敵陣進入で判定します
      if (!move.from) return false;
      return move.to.y <= 2; // 3段目以内（インデックス0,1,2）
    },
    successMessage: "進化完了！馬は「角の動き＋王様の動き（上下左右1マス）」ができる最強格の駒です。"
  }
];

// 7. 飛車（ひしゃ）
export const ROOK_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "飛車（ひしゃ）の動き",
    description: "飛車は縦横にどこまでも進めます。将棋で最も攻める力が強い駒です。一気に前に進んでみましょう。",
    // 盤面: 2八に飛車
    sfen: "position sfen 9/9/9/9/9/9/9/1R7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      const dy = move.from.y - move.to.y;
      const dx = Math.abs(move.from.x - move.to.x);
      // 縦に2マス以上動けばOK
      return dx === 0 && dy >= 2;
    },
    successMessage: "素晴らしい！この突破力が飛車の武器です。"
  },
  {
    step: 2,
    title: "飛車が成る（龍）",
    description: "飛車も敵陣に入ると「龍（りゅう）」に成れます。敵陣に入って成ってみましょう！",
    // 盤面: 2八に飛車
    sfen: "position sfen 9/9/9/9/9/9/9/1R7/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      return move.to.y <= 2; // 敵陣に入る
    },
    successMessage: "最強駒「龍」の誕生です！龍は「飛車の動き＋王様の動き（斜め1マス）」ができます。"
  }
];

// 8. 王将（おうしょう）
export const KING_LESSONS: TrainingStep[] = [
  {
    step: 1,
    title: "王将（玉）の動き",
    description: "王様（玉）は全方向に1マスずつ動けます。取られたら負けなので、逃げる練習をしましょう。上へ逃げてください。",
    // 盤面: 5八に玉
    sfen: "position sfen 9/9/9/9/9/9/9/4K4/9 b - 1",
    checkMove: (move) => {
      if (!move.from) return false;
      // 5八(x:4, y:7) から 5七(x:4, y:6) など上方向へ
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
    // 盤面: 2一に玉(k), 2三に歩(p), 持ち駒に金(G)
    sfen: "position sfen 7k1/9/7p1/9/9/9/9/9/9 b G 1",
    checkMove: (move) => {
      // 2二(x:7, y:1)に金を打てば正解
      // ※ xは0始まりのインデックス: 9筋=0 ... 2筋=7
      return move.drop === true && move.to.x === 7 && move.to.y === 1;
    },
    successMessage: "正解！頭金（あたまきん）です。2三の歩が邪魔で、玉は逃げられません。"
  }
];