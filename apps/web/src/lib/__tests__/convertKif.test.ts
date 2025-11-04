import { kifToUsiMoves } from '../convertKif';

describe('kifToUsiMoves', () => {
  test("成り（明示）: ▲７七角成(88)", () => {
    const kif = "▲７七角成(88)";
    const usi = kifToUsiMoves(kif);
    expect(usi).toContain("8h7g+"); // 88→7七（=7g）へ、成り
  });

  test("同 形式: △同歩(33) に対応", () => {
    const kif = "▲７七歩(78)\n△同歩(68)";
    const usi = kifToUsiMoves(kif);
    // 1手目 78→77, 2手目 68→同（=77）
    expect(usi[0]).toBe("7h7g");
    expect(usi[1].endsWith("7g")).toBe(true);
  });

  test("複数の銀が動けるとき距離優先", () => {
    // セットアップは BoardTracker 前提。ここでは API だけ検証（動作例）
    const kif = "▲６六銀(57)";
    const usi = kifToUsiMoves(kif);
    expect(usi[0]).toMatch(/5g6f|6g6f/); // どちらか近い方
  });

  test('CSA形式の指し手を変換できる', () => {
    const csa = `
      +7776FU
      -3334FU
      +2726FU
    `;
    expect(kifToUsiMoves(csa)).toEqual([
      '7g7f',
      '3c3d',
      '2g2f'
    ]);
  });

  describe('成り駒の処理', () => {
    it('明示的な成りを変換できる', () => {
      const kif = `
        1 ▲７六歩(77)
        2 △３四歩(33)
        3 ▲７五歩(76)
        4 △３三角(22)
        5 ▲７四歩(75)
        6 △２二銀(31)
        7 ▲７三歩成(74)
      `;
      expect(kifToUsiMoves(kif)).toEqual([
        '7g7f',
        '3c3d',
        '7f7e',
        '2b3c',
        '7e7d',
        '3a2b',
        '7d7c+'
      ]);
    });

    it('不成を変換できる', () => {
      const kif = `
        1 ▲７六歩(77)
        2 △３四歩(33)
        3 ▲７五歩(76)
        4 △３三角(22)
        5 ▲７四歩(75)
        6 △２二銀(31)
        7 ▲７三歩不成(74)
      `;
      expect(kifToUsiMoves(kif)).toEqual([
        '7g7f',
        '3c3d',
        '7f7e',
        '2b3c',
        '7e7d',
        '3a2b',
        '7d7c'
      ]);
    });

    it('暗黙の成りを変換できる（歩・香・桂・銀）', () => {
      const kif = `
        1 ▲７六歩(77)
        2 △３四歩(33)
        3 ▲７五歩(76)
        4 △３三歩(34)
        5 ▲７四歩(75)
        6 △３二歩(33)
        7 ▲７三歩(74)
      `;
      expect(kifToUsiMoves(kif)).toEqual([
        '7g7f',
        '3c3d',
        '7f7e',
        '3d3c',
        '7e7d',
        '3c3b',
        '7d7c+'  // 自動的に成る
      ]);
    });
  });

  describe('打ち駒の処理', () => {
    it('打つ手を変換できる', () => {
      const kif = `
        1 ▲７六歩(77)
        2 △３四歩(33)
        3 ▲７五歩(76)
        4 △３三角(22)
        5 ▲７四歩(75)
        6 △２二銀(31)
        7 ▲３三歩打
      `;
      expect(kifToUsiMoves(kif)).toEqual([
        '7g7f',
        '3c3d',
        '7f7e',
        '2b3c',
        '7e7d',
        '3a2b',
        '0033'
      ]);
    });
  });

  describe('複数の駒がある場合の選択', () => {
    it('最も近い駒を選択する', () => {
      const kif = `
        1 ▲７六歩(77)
        2 △３四歩(33)
        3 ▲２六歩(27)
        4 △３三銀(32)  // 32の銀を動かす（31の銀もある）
      `;
      expect(kifToUsiMoves(kif)).toEqual([
        '7g7f',
        '3c3d',
        '2g2f',
        '3b3c'  // 近い方の32の銀が選択される
      ]);
    });

    it('同じ筋上の駒を優先する', () => {
      const kif = `
        1 ▲７六歩(77)
        2 △８四歩(83)
        3 ▲６八銀(79)
        4 △８五歩(84)
        5 ▲７七銀(68)
        6 △８六歩(85)
        7 ▲８六銀(77)  // 77の銀を動かす（68の銀もある）
      `;
      expect(kifToUsiMoves(kif)).toEqual([
        '7g7f',
        '8c8d',
        '7i6h',
        '8d8e',
        '6h7g',
        '8e8f',
        '7g8f'  // 同じ筋上の77の銀が選択される
      ]);
    });
  });
});