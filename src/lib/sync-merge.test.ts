import { describe, expect, it } from "vitest";
import { mergeRemote, toWire } from "./sync-merge";
import type { Entry } from "./types";

const local = (over: Partial<Entry> = {}): Entry => ({
  id: "entry-0001", title: "mine", body: "mine", mood: null, promptUsed: null,
  createdAt: 1, updatedAt: 100, deletedAt: null, dirty: 0, ...over,
});
const remote = (over = {}) => ({ id: "entry-0001", title: "theirs", body: "theirs", mood: null, promptUsed: null, createdAt: 1, updatedAt: 200, deletedAt: null, ...over });

describe("mergeRemote", () => {
  it("adds entries we do not have", () => {
    expect(mergeRemote(undefined, remote())).toEqual({ ...remote(), dirty: 0 });
  });
  it("takes a newer remote over a clean local copy", () => {
    expect(mergeRemote(local(), remote())?.body).toBe("theirs");
  });
  it("never overwrites newer local edits that have not synced yet", () => {
    expect(mergeRemote(local({ dirty: 1, updatedAt: 300 }), remote())).toBeNull();
  });
  it("an older remote does not replace a newer local copy", () => {
    expect(mergeRemote(local({ updatedAt: 300 }), remote())).toBeNull();
  });
  it("ignores an identical echo of our own push", () => {
    expect(mergeRemote(local({ updatedAt: 200 }), remote())).toBeNull();
  });
  it("applies a remote deletion", () => {
    const merged = mergeRemote(local(), remote({ deletedAt: 200, title: "", body: "" }));
    expect(merged?.deletedAt).toBe(200);
    expect(merged?.body).toBe("");
  });
});

describe("toWire", () => {
  it("never sends the device-only dirty flag", () => {
    expect(toWire(local({ dirty: 1 }))).not.toHaveProperty("dirty");
  });
});
