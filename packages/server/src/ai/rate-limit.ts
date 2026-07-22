/**
 * レート制限・クールダウンの汎用カウンタ(ai-integration.md「レート・コスト保護」/
 * guardrails 第3層)。
 *
 * - クロック注入式(`now: () => number`、ミリ秒)。テストで時刻を進められる。
 * - 「最終実行時刻から N ミリ秒」チェック(会話送信レート・シーン別クールダウン兼用)。
 * - 同一内容の連続送信の拒否判定。
 * - **プロセス全体で単一**に使う想定(WS 接続・タブ・シーンごとに分離しない。
 *   多重接続による並列回避を防ぐ)。キーで対象(会話送信・talk:NPC・夢・クエスト等)を分ける。
 */
export class RateLimiter {
  private readonly now: () => number;
  private readonly lastAtMs = new Map<string, number>();
  private readonly lastContent = new Map<string, string>();

  public constructor(now: () => number) {
    this.now = now;
  }

  /**
   * キーに対する最短間隔チェック。前回実行から `minIntervalMs` 以上経過していれば
   * 許可し、最終実行時刻を更新して true を返す(消費)。未経過なら false(更新しない)。
   */
  public tryAcquire(key: string, minIntervalMs: number): boolean {
    const nowMs = this.now();
    const last = this.lastAtMs.get(key);
    if (last !== undefined && nowMs - last < minIntervalMs) {
      return false;
    }
    this.lastAtMs.set(key, nowMs);
    return true;
  }

  /**
   * キーが今すぐ実行可能になるまでの残りミリ秒(0 なら可)。消費しない(照会のみ)。
   * UI のクールダウン表示・事前判定に使う。
   */
  public msUntilReady(key: string, minIntervalMs: number): number {
    const last = this.lastAtMs.get(key);
    if (last === undefined) return 0;
    const elapsed = this.now() - last;
    return elapsed >= minIntervalMs ? 0 : minIntervalMs - elapsed;
  }

  /**
   * 同一内容の連続送信の拒否判定。前回このキーで受理した内容と同一なら false。
   * 異なれば内容を記録して true を返す(受理)。
   */
  public acceptContent(key: string, content: string): boolean {
    if (this.lastContent.get(key) === content) {
      return false;
    }
    this.lastContent.set(key, content);
    return true;
  }

  /** 指定キー(未指定なら全キー)の記録を消去する */
  public reset(key?: string): void {
    if (key === undefined) {
      this.lastAtMs.clear();
      this.lastContent.clear();
      return;
    }
    this.lastAtMs.delete(key);
    this.lastContent.delete(key);
  }
}
