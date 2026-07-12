# 雑魚敵シンボルのマップ非表示(透明化) 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マップ探索中の雑魚敵シンボルを描画しない(サーバー側の存在・徘徊・接触戦闘は不変=透明化)。

**Architecture:** クライアントの `ExplorationScene` から雑魚シンボル描画(`updateEnemySymbols()`)だけを削除する。サーバー・sharedスキーマ・E2Eが読む `data-symbol-count` 属性(snapshot由来)には一切触れない。ボス「夢喰い」・中ボス「紡ぎ損ない」の固定シンボル描画(`drawBoss()`/`drawMidBoss()`)は残す。

**Tech Stack:** TypeScript strict / Phaser 3(client)/ pnpm workspace。検証は `pnpm check` と `pnpm test:e2e`(Playwrightスモーク)。

**設計書:** `docs/superpowers/specs/2026-07-12-hide-mob-symbols-design.md`

## Global Constraints

- コミット前に `pnpm check` が緑であること(品質ゲート)
- コード変更を含むコミットは `pnpm test:e2e`(スモーク。約10分)も緑であること
- コミットメッセージは `feat:` `docs:` 等プレフィックス+日本語要約
- `main` へ直接コミットしない(現在の作業ブランチ `cluade/loop` のまま作業する)
- 識別子は英語・コメントは日本語。`any` 禁止
- 新規テストは追加しない(描画の削除のみで新ロジックなし。本リポジトリはPhaserシーンの
  描画をユニットテスト対象にしておらず、E2Eはsnapshot由来の `data-symbol-count` と
  マップデータ+固定シードの座標計算で戦闘を起こすため描画非依存 — 既存テストが回帰検知を担う)
- 以下は**変更禁止**(透明化の不変条件): `packages/server/` 全体、
  `packages/shared/` 全体、`exploration-scene.ts` の `syncDomState()`
  (`data-symbol-count` を書く箇所)、`drawBoss()`、`drawMidBoss()`

---

### Task 1: 雑魚シンボル描画の削除(client)

**Files:**
- Modify: `packages/client/src/scenes/exploration-scene.ts`(これ1ファイルのみ)

**Interfaces:**
- Consumes: なし(既存コードの削除のみ)
- Produces: なし(後続Taskはドキュメントのみ)

**背景(実装者向け):** 雑魚シンボルは `updateEnemySymbols()` が snapshot の `symbols` 配列から描画している。呼び出しは `create()` と `handleSnapshot()` の2箇所。フィールド `symbolViews` / `symbolsKey` はこのメソッド(と `create()` でのリセット)でしか使われていない。一方、`SYMBOL_COLORS` は `drawMidBoss()` のフォールバック描画(`SYMBOL_COLORS[midBoss.enemyId]`)でも使うため**残す**。`directionalTextureId()` / `mapSprite()` もNPC・プレイヤー・ボス描画で使うため**残す**。

- [ ] **Step 1: クラスdocコメントに非描画の制約を1行追記**

`exploration-scene.ts` のクラスコメント(95行付近)を変更:

```ts
/**
 * 探索シーン(見下ろしグリッド移動)。サーバー正本のスナップショット駆動:
 * - 移動・調べる等の操作は GameClient でサーバーへ送り、snapshot を受けて描画を更新する
 * - マップ遷移・戦闘開始も snapshot(mapId 変化 / mode==="battle")で検知する
 * - dialog はグローバルキュー(dialog-queue)から表示可能なタイミングで順に表示する
 * - 雑魚の敵シンボルは描画しない(2026-07-12 オーナー指示の透明化)。サーバー側には
 *   存在・徘徊しており、接触すると従来どおり戦闘が始まる(ボス・中ボスは描画する)
 * 描画そのもの(タイル・NPC・シンボル)はプレースホルダーのまま(M5で差し替え)。
 */
```

(最後のプレースホルダー行は既存のまま。追記は「雑魚の敵シンボルは〜」の2行のみ)

- [ ] **Step 2: フィールド `symbolViews` / `symbolsKey` を削除**

254-257行付近の以下を削除:

```ts
  private symbolViews: Phaser.GameObjects.GameObject[] = [];

  /** 描画済みシンボルのキー(差分がある時だけ再描画する) */
  private symbolsKey = "";
```

- [ ] **Step 3: `create()` 内のリセット2行を削除**

317-318行付近(`this.objectViews.clear();` の直後)の以下を削除:

```ts
    this.symbolViews = [];
    this.symbolsKey = "";
```

- [ ] **Step 4: `updateEnemySymbols()` の呼び出し2箇所を削除**

`create()` 内(`this.drawMidBoss();` の直後)と `handleSnapshot()` 内(移動tween処理の直後)にある、次の同一行を**2箇所とも**削除:

```ts
    this.updateEnemySymbols();
```

- [ ] **Step 5: `updateEnemySymbols()` メソッド本体を削除**

1488-1521行付近、docコメントごと削除(`drawMidBoss()` と `createPlayer()` の間にある):

```ts
  /** snapshot の敵シンボルを描画へ反映する(差分がある時だけ再構築) */
  private updateEnemySymbols(): void {
    const key = this.snapshot.symbols
      .map((s) => `${s.enemyId}@${s.position.x},${s.position.y}:${s.facing}`)
      .join("|");
    if (key === this.symbolsKey) {
      return;
    }
    this.symbolsKey = key;
    this.symbolViews.forEach((view) => {
      view.destroy();
    });
    this.symbolViews = [];
    for (const symbol of this.snapshot.symbols) {
      const { x, y } = this.tileCenter(symbol.position);
      // 敵シンボルのスプライト(symbol-<enemyId>。M13-3)。未整備なら従来の菱形。
      // 向きはサーバーが湧き時に決めたランダム4方向(M17)の差分テクスチャで表現
      const view: Phaser.GameObjects.GameObject & { scale: number } =
        this.mapSprite(this.directionalTextureId(`symbol-${symbol.enemyId}`, symbol.facing), x, y, 34) ??
        this.add
          .polygon(x, y, [0, -12, 12, 0, 0, 12, -12, 0], SYMBOL_COLORS[symbol.enemyId])
          .setStrokeStyle(2, 0x0b0d12);
      this.tweens.add({
        targets: view,
        scale: view.scale * 1.15,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      this.worldLayer.add(view);
      this.symbolViews.push(view);
    }
  }
```

- [ ] **Step 6: `SYMBOL_COLORS` のdocコメントを実態に合わせる**

80行付近のコメントを変更(テーブル本体は `drawMidBoss()` のフォールバックで使うため不変):

変更前:

```ts
/** 敵シンボルのプレースホルダーカラー(敵種別。グラフィックはM5) */
```

変更後:

```ts
/** 敵マーカーのプレースホルダーカラー(雑魚シンボルは非描画のため、現在は中ボス描画のフォールバックのみで使用) */
```

- [ ] **Step 7: `pnpm check` を実行して緑を確認**

Run: `pnpm check`
Expected: 最後に `Secret scan passed.` が出て終了コード0(typecheck/lint/unit/buildすべて緑)。
`symbolViews` / `symbolsKey` / `updateEnemySymbols` の参照が残っているとtypecheck/lint(no-unused等)が赤になるので、赤ならStep 2-5の削除漏れを確認する。

- [ ] **Step 8: `pnpm test:e2e` を実行して緑を確認**

Run: `pnpm test:e2e`
Expected: 24件すべてPASS(約10分)。特に `tests/e2e/battle.spec.ts` と `tests/e2e/skill.spec.ts` は雑魚シンボルへ接触して戦闘を起こすテストで、座標はマップデータ+固定シードから計算し `data-symbol-count`(snapshot由来)を読むため、描画削除の影響を受けないことの実証になる。

- [ ] **Step 9: コミット**

```bash
git add packages/client/src/scenes/exploration-scene.ts
git commit -m "feat: 雑魚敵シンボルをマップ上で非描画に=透明化(オーナー指示。サーバー側の存在・接触戦闘は不変)"
```

---

### Task 2: 仕様書への注記とJOURNAL記録(docs)

**Files:**
- Modify: `docs/spec/game-design.md`(「マップ構成」直後の箇条書き)
- Modify: `docs/progress/JOURNAL.md`(末尾にエントリ追記)

**Interfaces:**
- Consumes: Task 1がコミット済みであること(JOURNALに実施内容として書くため)
- Produces: なし(最終Task)

**背景(実装者向け):** シンボルエンカウント(見える敵)の変更はオーナー指示(2026-07-12)による仕様変更。CLAUDE.mdの原則では仕様書は勝手に変えないが、今回はオーナーの直接指示のため注記を追加し、JOURNALにその旨を記録する。ROADMAPのチェックボックスに該当項目はない(マイルストーン外の指示対応)ため触らない。

- [ ] **Step 1: `game-design.md` に不可視の注記を追加**

40-42行付近の以下の箇条書きの**直後**に:

```markdown
- **敵シンボル数のマップ別レンジは上表が唯一の正**: フィールド2-3体、ダンジョン各層2-6体
  (`ai-integration.md`の`dungeon_shift`はこの表を参照する)
```

次の箇条書きを追加する:

```markdown
- 雑魚の敵シンボルはマップ上で**不可視**とする(2026-07-12 オーナー指示)。存在・徘徊・
  接触での戦闘開始・リスポーン・数レンジは従来どおりで、クライアントが描画しないだけ。
  ボス「夢喰い」・中ボス「紡ぎ損ない」の固定シンボルは従来どおり表示する
```

- [ ] **Step 2: `JOURNAL.md` 末尾にエントリ [89] を追記**

ファイル末尾(エントリ [88] の後)に追記(フォーマットはJOURNAL冒頭の規定どおり):

```markdown
## [89] 2026-07-12 雑魚敵シンボルのマップ非表示=透明化(オーナー指示)

- やったこと:
  - オーナー指示「マップ上に敵を表示しないようにしたい」を実装(ヒアリングで
    「雑魚のみ非表示・ボス/中ボスは表示・接触戦闘は残す=透明化」に確定)
  - client(exploration-scene.ts): updateEnemySymbols()本体・呼び出し2箇所・
    symbolViews/symbolsKeyフィールドを削除し、雑魚シンボルを描画しない。
    SYMBOL_COLORS・directionalTextureId・mapSpriteは中ボス/NPC/プレイヤー描画で
    使用するため残置。drawBoss()/drawMidBoss()は不変
  - server/shared: 無変更(雑魚シンボルの存在・徘徊・接触戦闘・リスポーン・
    huntカウント・snapshotのsymbols・data-symbol-count属性は従来どおり)
  - docs: game-design.md「マップ構成」に不可視の注記を追加(オーナー指示による仕様変更)。
    設計書=docs/superpowers/specs/2026-07-12-hide-mob-symbols-design.md、
    実装計画=docs/superpowers/plans/2026-07-12-hide-mob-symbols.md
- 検証: pnpm check緑・pnpm test:e2eスモーク緑(battle/skill等はマップデータ+固定シードの
  座標計算で接触し data-symbol-count(snapshot由来)を読む=描画非依存を実証)
- 裁量で決めたこと: 表示切替フラグは設けず恒久削除(YAGNI。戻す場合はgit履歴から復元)
- 次にやること: JOURNAL[88]の継続項目のまま(BACKLOG未着手項目・pnpm test:ai-liveの
  人間確認待ち)。本件の実プレイでの見え方確認(雑魚が見えない状態での接触戦闘の体感)は
  人間確認待ち
```

- [ ] **Step 3: `pnpm check` を実行して緑を確認**

Run: `pnpm check`
Expected: `Secret scan passed.` で終了コード0(ドキュメントのみの変更だが品質ゲートは常に適用)。

- [ ] **Step 4: コミット**

```bash
git add docs/spec/game-design.md docs/progress/JOURNAL.md
git commit -m "docs: 雑魚シンボル不可視の仕様注記(オーナー指示)+JOURNAL[89]"
```
