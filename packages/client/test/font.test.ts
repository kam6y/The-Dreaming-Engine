import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_FONT_FAMILY, waitForUiFont, type FontLoader } from "../src/ui/font.js";

describe("UI_FONT_FAMILY", () => {
  it("しっぽり明朝を第一候補に、serif フォールバックを持つ", () => {
    expect(UI_FONT_FAMILY).toContain('"Shippori Mincho"');
    expect(UI_FONT_FAMILY.endsWith("serif")).toBe(true);
  });
});

describe("waitForUiFont", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loader が無い環境(非ブラウザ)では即座に解決する", async () => {
    await expect(waitForUiFont(undefined)).resolves.toBeUndefined();
  });

  it("loader.load に基本フォントの指定を渡し、完了で解決する", async () => {
    const load = vi.fn().mockResolvedValue([]);
    const loader: FontLoader = { load };
    await expect(waitForUiFont(loader)).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0]).toContain(UI_FONT_FAMILY);
  });

  it("loader.load が失敗しても解決する(起動を阻害しない)", async () => {
    const loader: FontLoader = {
      load: () => Promise.reject(new Error("font error"))
    };
    await expect(waitForUiFont(loader)).resolves.toBeUndefined();
  });

  it("loader.load が完了しない場合はタイムアウトで解決する", async () => {
    vi.useFakeTimers();
    const loader: FontLoader = {
      load: () => new Promise(() => {})
    };
    const pending = waitForUiFont(loader, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBeUndefined();
  });
});
