import { expect, test } from "@playwright/test";

test("タイトル文字が表示され、サーバーとping-pongできる", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "The Dreaming Engine" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("サーバー: 接続済み")).toBeVisible({ timeout: 10_000 });
});
