import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { canonicalMailbox, rateLimit, sha256Hex } from "../rate-limit";
import { createTestDb } from "./sqlite-d1";

let db: Db;
beforeEach(() => {
  ({ db } = createTestDb());
});

const T0 = 1_700_000_000_000; // arbitrary instant

describe("rateLimit", () => {
  it("allows up to the limit then blocks", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await rateLimit(db, "k", 3, 60, T0)).allowed);
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("reports how long until the window resets", async () => {
    const r = await rateLimit(db, "k", 1, 60, T0);
    expect(r.retryAfter).toBeGreaterThanOrEqual(1);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });

  it("resets in the next window", async () => {
    for (let i = 0; i < 4; i++) await rateLimit(db, "k", 3, 60, T0);
    expect((await rateLimit(db, "k", 3, 60, T0)).allowed).toBe(false);
    expect((await rateLimit(db, "k", 3, 60, T0 + 61_000)).allowed).toBe(true);
  });

  it("keeps keys independent", async () => {
    await rateLimit(db, "a", 1, 60, T0);
    expect((await rateLimit(db, "a", 1, 60, T0)).allowed).toBe(false);
    expect((await rateLimit(db, "b", 1, 60, T0)).allowed).toBe(true);
  });
});

describe("sha256Hex", () => {
  it("is stable and hides the input", async () => {
    expect(await sha256Hex("a@b.co")).toHaveLength(64);
    expect(await sha256Hex("a@b.co")).toBe(await sha256Hex("a@b.co"));
    expect(await sha256Hex("a@b.co")).not.toContain("a@b.co");
  });
});

describe("canonicalMailbox", () => {
  it("treats plus-tags and case as the same mailbox", () => {
    expect(canonicalMailbox("Victim+1@Example.com")).toBe("victim@example.com");
    expect(canonicalMailbox("victim+spam@example.com")).toBe("victim@example.com");
  });
  it("ignores dots and googlemail for Gmail only", () => {
    expect(canonicalMailbox("v.i.c.tim+x@googlemail.com")).toBe("victim@gmail.com");
    expect(canonicalMailbox("v.ictim@example.com")).toBe("v.ictim@example.com");
  });
});
