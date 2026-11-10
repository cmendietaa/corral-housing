import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeNonce } from "./nonce";

describe("makeNonce", () => {
  it("returns a raw nonce and its SHA-256 hex hash", async () => {
    const { raw, hashed } = await makeNonce();
    expect(raw.length).toBeGreaterThanOrEqual(43);
    expect(hashed).toBe(createHash("sha256").update(raw).digest("hex"));
  });

  it("is different every time", async () => {
    const [a, b] = await Promise.all([makeNonce(), makeNonce()]);
    expect(a.raw).not.toBe(b.raw);
  });
});
