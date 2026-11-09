import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { deleteUserImages, findImage, imageKey, MAX_IMAGES_PER_USER, putImage, type Bucket } from "../image-store";
import { sniffImage } from "../image-sniff";
import { addUser, createTestDb } from "./sqlite-d1";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = new TextEncoder().encode("GIF89a....");
const WEBP = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");

describe("sniffImage", () => {
  it("recognises the four allowed formats from their bytes", () => {
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(JPG)).toBe("image/jpeg");
    expect(sniffImage(GIF)).toBe("image/gif");
    expect(sniffImage(WEBP)).toBe("image/webp");
  });
  it("rejects SVG, HTML, scripts and truncated data", () => {
    for (const s of ["<svg xmlns='http://www.w3.org/2000/svg'/>", "<html><script>alert(1)</script>", "GIF", "\x89PNG"]) {
      expect(sniffImage(new TextEncoder().encode(s))).toBeNull();
    }
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

class FakeBucket implements Bucket {
  objects = new Map<string, Uint8Array>();
  async put(key: string, value: Uint8Array) { this.objects.set(key, value); }
  async get(key: string) { const v = this.objects.get(key); return v ? { body: new Blob([v as BlobPart]).stream() } : null; }
  async list({ prefix }: { prefix: string }) { return { objects: [...this.objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; }
  async delete(keys: string[]) { keys.forEach((k) => this.objects.delete(k)); }
}

let db: Db;
let raw: ReturnType<typeof createTestDb>["raw"];
let bucket: FakeBucket;
beforeEach(() => {
  ({ db, raw } = createTestDb());
  addUser(raw, "alice");
  addUser(raw, "bob");
  bucket = new FakeBucket();
});

describe("image store", () => {
  it("stores once and treats repeats as a no-op", async () => {
    expect(await putImage(db, bucket, "alice", "img-00001", "image/png", PNG)).toBe("created");
    expect(await putImage(db, bucket, "alice", "img-00001", "image/png", JPG)).toBe("exists");
    expect(bucket.objects.get(imageKey("alice", "img-00001"))).toEqual(PNG); // not overwritten
  });
  it("only serves an image to its owner", async () => {
    await putImage(db, bucket, "alice", "img-00001", "image/png", PNG);
    expect(await findImage(db, bucket, "alice", "img-00001")).not.toBeNull();
    expect(await findImage(db, bucket, "bob", "img-00001")).toBeNull();
  });
  it("the same id for two users does not collide", async () => {
    await putImage(db, bucket, "alice", "img-00001", "image/png", PNG);
    expect(await putImage(db, bucket, "bob", "img-00001", "image/jpeg", JPG)).toBe("created");
    expect(bucket.objects.get(imageKey("alice", "img-00001"))).toEqual(PNG);
  });
  it("enforces the per-account image count", async () => {
    raw.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < ${MAX_IMAGES_PER_USER}) INSERT INTO user_images SELECT 'alice', 'bulk-' || i, 1, 'image/png', 0 FROM n`);
    expect(await putImage(db, bucket, "alice", "img-extra01", "image/png", PNG)).toBe("quota");
    expect(await putImage(db, bucket, "bob", "img-00001", "image/png", PNG)).toBe("created");
  });
  it("deleting an account removes only that user's objects", async () => {
    await putImage(db, bucket, "alice", "img-00001", "image/png", PNG);
    await putImage(db, bucket, "bob", "img-00002", "image/png", PNG);
    await deleteUserImages(bucket, "alice");
    expect([...bucket.objects.keys()]).toEqual([imageKey("bob", "img-00002")]);
  });
});
