/**
 * マップの行文字列を組み立てる内部ヘルパー。
 * 常に width×height の矩形グリッドを保証し、手書き行のズレによる不整合を防ぐ。
 * 生成した rows は各マップ定義側で mapDefinitionSchema.parse により最終検証する。
 */
export class GridBuilder {
  private readonly cells: string[][];

  constructor(
    public readonly width: number,
    public readonly height: number,
    fill = "."
  ) {
    this.cells = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => fill)
    );
  }

  private within(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, ch: string): this {
    if (this.within(x, y)) {
      const row = this.cells[y];
      if (row) row[x] = ch;
    }
    return this;
  }

  /** 塗りつぶし矩形(x0..x1, y0..y1 を含む) */
  rect(x0: number, y0: number, x1: number, y1: number, ch: string): this {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        this.set(x, y, ch);
      }
    }
    return this;
  }

  /** 外周を1マスの枠で囲む */
  border(ch = "#"): this {
    this.rect(0, 0, this.width - 1, 0, ch);
    this.rect(0, this.height - 1, this.width - 1, this.height - 1, ch);
    this.rect(0, 0, 0, this.height - 1, ch);
    this.rect(this.width - 1, 0, this.width - 1, this.height - 1, ch);
    return this;
  }

  /** 横方向の直線(x0..x1) */
  hLine(y: number, x0: number, x1: number, ch: string): this {
    for (let x = x0; x <= x1; x += 1) this.set(x, y, ch);
    return this;
  }

  /** 縦方向の直線(y0..y1) */
  vLine(x: number, y0: number, y1: number, ch: string): this {
    for (let y = y0; y <= y1; y += 1) this.set(x, y, ch);
    return this;
  }

  rows(): string[] {
    return this.cells.map((row) => row.join(""));
  }
}
