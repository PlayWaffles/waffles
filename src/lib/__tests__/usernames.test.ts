import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import {
  generateUniqueMiniPayUsername,
  getMiniPayUsernameBase,
} from "@/lib/usernames";

describe("MiniPay username generation", () => {
  it("generates readable lowercase names from a wallet seed", () => {
    const username = getMiniPayUsernameBase(
      "0x1111111111111111111111111111111111111111",
    );

    assert.match(username, /^[a-z]+_[a-z]+$/);
    assert.doesNotMatch(username, /^waffles?_\d+$/);
  });

  it("returns the base username when it is available", async () => {
    const username = await generateUniqueMiniPayUsername(
      "0x2222222222222222222222222222222222222222",
      async () => false,
    );

    expect(username).toBe(
      getMiniPayUsernameBase("0x2222222222222222222222222222222222222222"),
    );
  });

  it("adds a numeric suffix when the base username is already taken", async () => {
    const base = getMiniPayUsernameBase(
      "0x3333333333333333333333333333333333333333",
    );

    const username = await generateUniqueMiniPayUsername(
      "0x3333333333333333333333333333333333333333",
      async (candidate) => candidate === base,
    );

    assert.match(username, new RegExp(`^${base}_\\d{2}$`));
  });

  it("surfaces failure when every candidate is taken", async () => {
    await assert.rejects(
      () =>
        generateUniqueMiniPayUsername(
          "0x4444444444444444444444444444444444444444",
          async () => true,
        ),
      /Unable to generate a unique MiniPay username/,
    );
  });
});
