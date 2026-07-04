import Phaser from "phaser";

/**
 * アセット台帳(assets/manifest.json)の1エントリ。
 * クライアントは path 直書きをせず、この台帳経由で id → 画像をロードする
 * (asset-pipeline.md「ファイル管理規約」)。
 */
interface AssetEntry {
  id: string;
  path: string;
  kind: string;
}

/**
 * 起動時のプリロードシーン。assets/manifest.json を読み、台帳の全画像を id で
 * テクスチャに読み込んでからタイトルへ遷移する。個々の画像の読み込み失敗は
 * ログのみで無視し(各シーンは textures.exists で存在確認しプレースホルダーへ退避)、
 * アセット未整備でもゲームが起動できるようにする。
 */
export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super("preload");
  }

  public preload(): void {
    this.cameras.main.setBackgroundColor("#0b0d12");
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2 - 20, "夢見る機関を呼び起こしています…", {
        color: "#a9b0ba",
        fontFamily: "serif",
        fontSize: "18px"
      })
      .setOrigin(0.5);
    const barBg = this.add
      .rectangle(width / 2, height / 2 + 16, 320, 6, 0x2a2e38)
      .setOrigin(0.5);
    const bar = this.add
      .rectangle(barBg.x - 160, barBg.y, 0, 6, 0xd8c98f)
      .setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.width = 320 * value;
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      // 個別アセットの欠落は致命ではない(各シーンがプレースホルダーへ退避する)
      console.warn(`[preload] アセット読み込み失敗: ${file.key}`);
    });

    // まず台帳を読み、その完了時に全画像をキューへ積む(ロード中の追加は継続処理される)
    this.load.json("asset-manifest", "assets/manifest.json");
    this.load.once("filecomplete-json-asset-manifest", () => {
      const manifest = this.cache.json.get("asset-manifest") as AssetEntry[] | undefined;
      if (!Array.isArray(manifest)) {
        console.warn("[preload] manifest.json を読めませんでした。プレースホルダーで進行します");
        return;
      }
      for (const entry of manifest) {
        if (typeof entry.id === "string" && typeof entry.path === "string") {
          this.load.image(entry.id, entry.path);
        }
      }
    });

    // 参照だけで未使用警告にならないよう(演出用の一時オブジェクト)
    void label;
  }

  public create(): void {
    this.scene.start("title");
  }
}
