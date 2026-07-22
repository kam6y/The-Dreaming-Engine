/**
 * サーバー dialog メッセージのグローバルキュー。
 *
 * dialog はシーン遷移(戦闘→探索など)を跨いで届き得るため、main.ts が受信時に
 * ここへ積み、探索シーンが表示可能なタイミングで1件ずつ取り出して表示する
 * (戦闘中に届いた全滅・戦利品あふれの文言も、探索復帰後に順に表示される)。
 */
export interface PendingDialog {
  speaker: string | null;
  body: string;
}

const queue: PendingDialog[] = [];

export function enqueueDialog(dialog: PendingDialog): void {
  queue.push(dialog);
}

export function dequeueDialog(): PendingDialog | undefined {
  return queue.shift();
}

export function hasPendingDialog(): boolean {
  return queue.length > 0;
}

/** 新規ゲーム開始時などに、前のプレイの未表示分を持ち越さないための破棄 */
export function clearDialogQueue(): void {
  queue.length = 0;
}
