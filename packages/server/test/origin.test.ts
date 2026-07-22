import { describe, expect, it } from "vitest";

import { DEFAULT_ALLOWED_ORIGINS, isAllowedOrigin } from "../src/origin.js";

describe("isAllowedOrigin", () => {
  it("accepts the configured Vite client origins", () => {
    expect(isAllowedOrigin("http://localhost:5173", DEFAULT_ALLOWED_ORIGINS)).toBe(
      true
    );
    expect(
      isAllowedOrigin("http://127.0.0.1:5173", DEFAULT_ALLOWED_ORIGINS)
    ).toBe(true);
  });

  it("rejects missing or unlisted origins", () => {
    expect(isAllowedOrigin(undefined, DEFAULT_ALLOWED_ORIGINS)).toBe(false);
    expect(isAllowedOrigin("https://example.com", DEFAULT_ALLOWED_ORIGINS)).toBe(
      false
    );
  });
});
