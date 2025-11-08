import { toStartposUSI } from "@/lib/ingest";
import { splitKifGames } from "@/lib/ingest";

describe("toStartposUSI", () => {
  it("KIFをUSIに変換できる", () => {
    const kif = `
先手：A　後手：B
1 ７六歩(77)
2 ３四歩(33)
3 ２六歩(27)
    `.trim();
    const usi = toStartposUSI(kif);
    expect(usi.startsWith("startpos moves ")).toBe(true);
    // ざっくりUSI手が含まれているか
    expect(usi).toMatch(/7g7f|7g7f/);
  });

  it("CSAをUSIに変換できる", () => {
    const csa = `
V2.2
N+Sente
N-Gote
+7776FU
-3334FU
+2726FU
    `.trim();
    const usi = toStartposUSI(csa);
    expect(usi.startsWith("startpos moves ")).toBe(true);
    expect(usi).toMatch(/7g7f/);
  });

  it("USIはそのまま返す", () => {
    const usiIn = "startpos moves 7g7f 3c3d";
    const usi = toStartposUSI(usiIn);
    expect(usi).toBe(usiIn);
  });

  it("複数局のKIFを分割できる", () => {
    const multi = `先手：A\n1 ７六歩(77)\nまで1手\n\n先手：B\n1 ３四歩(33)\nまで1手`;
    const games = splitKifGames(multi);
    expect(games.length).toBeGreaterThanOrEqual(2);
    expect(games[0]).toMatch(/７六歩/);
    expect(games[1]).toMatch(/３四歩/);
  });
});
