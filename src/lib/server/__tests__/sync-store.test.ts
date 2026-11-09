import { beforeEach, describe, expect, it } from "vitest";
import type { WireEntry } from "../../sync-schema";
import type { Db } from "../db";
import { applyChanges, deleteAccountData, pullChanges, QuotaError } from "../sync-store";
import { addUser, createTestDb } from "./sqlite-d1";

let db: Db;
let raw: ReturnType<typeof createTestDb>["raw"];

const entry = (over: Partial<WireEntry> = {}): WireEntry => ({
  id: "entry-0001",
  title: "A slow morning",
  body: "Woke up early.",
  mood: "Calm",
  promptUsed: null,
  createdAt: 1_000,
  updatedAt: 1_000,
  deletedAt: null,
  ...over,
});
const NOW = 10_000_000;

beforeEach(() => {
  ({ db, raw } = createTestDb());
  addUser(raw, "alice");
  addUser(raw, "bob");
});

describe("applyChanges / pullChanges", () => {
  it("stores entries and pulls them in change order", async () => {
    await applyChanges(db, "alice", [entry({ id: "entry-0001" }), entry({ id: "entry-0002", title: "Second" })], NOW);
    const res = await pullChanges(db, "alice", 0, 200);
    expect(res.changes.map((c) => c.id)).toEqual(["entry-0001", "entry-0002"]);
    expect(res.changes.map((c) => c.seq)).toEqual([1, 2]);
    expect(res.cursor).toBe(2);
    expect(res.hasMore).toBe(false);
  });

  it("only returns changes after the cursor", async () => {
    await applyChanges(db, "alice", [entry({ id: "entry-0001" }), entry({ id: "entry-0002" })], NOW);
    const res = await pullChanges(db, "alice", 1, 200);
    expect(res.changes.map((c) => c.id)).toEqual(["entry-0002"]);
    expect((await pullChanges(db, "alice", 2, 200)).changes).toEqual([]);
  });

  it("keeps the cursor when nothing is new", async () => {
    expect((await pullChanges(db, "alice", 7, 200)).cursor).toBe(7);
  });

  it("paginates with hasMore", async () => {
    await applyChanges(db, "alice", ["entry-0001", "entry-0002", "entry-0003"].map((id) => entry({ id })), NOW);
    const first = await pullChanges(db, "alice", 0, 2);
    expect(first.changes).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const second = await pullChanges(db, "alice", first.cursor, 2);
    expect(second.changes.map((c) => c.id)).toEqual(["entry-0003"]);
    expect(second.hasMore).toBe(false);
  });

  it("last write wins: newer edits apply, older and equal ones are ignored", async () => {
    await applyChanges(db, "alice", [entry({ body: "v1", updatedAt: 2_000 })], NOW);
    await applyChanges(db, "alice", [entry({ body: "stale", updatedAt: 1_500 })], NOW);
    await applyChanges(db, "alice", [entry({ body: "tie", updatedAt: 2_000 })], NOW);
    expect((await pullChanges(db, "alice", 0, 10)).changes[0].body).toBe("v1");

    await applyChanges(db, "alice", [entry({ body: "v2", updatedAt: 3_000 })], NOW);
    const res = await pullChanges(db, "alice", 0, 10);
    expect(res.changes).toHaveLength(1);
    expect(res.changes[0].body).toBe("v2");
    // an update moves the entry to the end of the change log so other devices see it
    expect(res.changes[0].seq).toBeGreaterThan(1);
  });

  it("does not bump the change number when an update is ignored", async () => {
    await applyChanges(db, "alice", [entry({ updatedAt: 2_000 })], NOW);
    await applyChanges(db, "alice", [entry({ updatedAt: 1_000, body: "old" })], NOW);
    expect((await pullChanges(db, "alice", 0, 10)).cursor).toBe(1);
  });

  it("tombstones drop their content", async () => {
    await applyChanges(db, "alice", [entry({ updatedAt: 2_000 })], NOW);
    await applyChanges(db, "alice", [entry({ updatedAt: 3_000, deletedAt: 3_000, title: "secret", body: "secret", mood: "Calm", promptUsed: "p" })], NOW);
    const [row] = (await pullChanges(db, "alice", 0, 10)).changes;
    expect(row.deletedAt).toBe(3_000);
    expect([row.title, row.body, row.mood, row.promptUsed]).toEqual(["", "", null, null]);
  });

  it("clamps timestamps far in the future so they cannot win forever", async () => {
    await applyChanges(db, "alice", [entry({ updatedAt: NOW + 10 * 86_400_000 })], NOW);
    const [row] = (await pullChanges(db, "alice", 0, 10)).changes;
    expect(row.updatedAt).toBeLessThanOrEqual(NOW + 5 * 60_000);
    // a genuine edit made "now" can still replace it afterwards
    await applyChanges(db, "alice", [entry({ updatedAt: NOW + 10 * 60_000, body: "later" })], NOW + 10 * 60_000);
    expect((await pullChanges(db, "alice", 0, 10)).changes[0].body).toBe("later");
  });

  it("isolates users: the same entry id never crosses accounts", async () => {
    await applyChanges(db, "alice", [entry({ body: "alice's" })], NOW);
    await applyChanges(db, "bob", [entry({ body: "bob's", updatedAt: 9_999 })], NOW);
    expect((await pullChanges(db, "alice", 0, 10)).changes.map((c) => c.body)).toEqual(["alice's"]);
    expect((await pullChanges(db, "bob", 0, 10)).changes.map((c) => c.body)).toEqual(["bob's"]);
  });

  it("enforces the per-account entry limit", async () => {
    raw.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 20000)
      INSERT INTO entries (user_id, id, title, body, created_at, updated_at, server_seq)
      SELECT 'alice', 'bulk-' || i, '', '', 0, 0, i FROM n`);
    await expect(applyChanges(db, "alice", [entry({ id: "one-too-many" })], NOW)).rejects.toBeInstanceOf(QuotaError);
  });

  it("is a no-op for an empty change list", async () => {
    await applyChanges(db, "alice", [], NOW);
    expect((await pullChanges(db, "alice", 0, 10)).changes).toEqual([]);
  });
});

describe("deleteAccountData", () => {
  it("removes the user, their entries, sessions and counters, and nobody else's", async () => {
    await applyChanges(db, "alice", [entry()], NOW);
    await applyChanges(db, "bob", [entry({ id: "entry-bob1" })], NOW);
    raw.exec(`INSERT INTO "session" (id, expiresAt, token, createdAt, updatedAt, userId) VALUES ('s1', 1, 't1', 0, 0, 'alice')`);
    raw.exec(`INSERT INTO rate_limit_hits (key, window_start, count) VALUES ('sync:alice', 0, 1), ('sync:bob', 0, 1)`);

    await deleteAccountData(db, "alice", "alice@example.com");

    expect(raw.prepare('SELECT COUNT(*) AS n FROM "user" WHERE id = ?').get("alice")).toEqual({ n: 0 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM entries WHERE user_id = ?").get("alice")).toEqual({ n: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM "session"').get()).toEqual({ n: 0 });
    expect(raw.prepare("SELECT key FROM rate_limit_hits").all()).toEqual([{ key: "sync:bob" }]);
    expect((await pullChanges(db, "bob", 0, 10)).changes).toHaveLength(1);
  });
});

describe("changing an entry's date", () => {
  it("moves created_at with a newer edit", async () => {
    const { db, raw } = createTestDb();
    addUser(raw, "alice");
    await applyChanges(db, "alice", [entry({ createdAt: 1_000, updatedAt: 1_000 })], NOW);
    await applyChanges(db, "alice", [entry({ createdAt: 5_000, updatedAt: 2_000 })], NOW);
    expect((await pullChanges(db, "alice", 0, 10)).changes[0].createdAt).toBe(5_000);
  });
});
