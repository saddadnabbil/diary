import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { Db, Stmt } from "../db";

/** Runs the same SQL as D1 on in-memory SQLite so the data layer can be tested without Cloudflare. */
class SqliteStmt implements Stmt {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new SqliteStmt(this.db, this.sql, values);
  }
  async first<T>() {
    return ((this.db.prepare(this.sql).get(...(this.params as never[])) as T | undefined) ?? null) as T | null;
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...(this.params as never[])) as T[] };
  }
  async run() {
    this.db.prepare(this.sql).run(...(this.params as never[]));
  }
}

export function createTestDb(): { db: Db; raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const f of ["0001_auth.sql", "0002_app.sql", "0003_images.sql", "0004_stories.sql"]) raw.exec(readFileSync(new URL(`../../../../migrations/${f}`, import.meta.url), "utf8"));
  const db: Db = {
    prepare: (sql) => new SqliteStmt(raw, sql),
    async batch(statements) {
      raw.exec("BEGIN");
      try {
        for (const s of statements) await s.run();
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
      return [];
    },
  };
  return { db, raw };
}

export function addUser(raw: DatabaseSync, id: string, email = `${id}@example.com`) {
  raw
    .prepare('INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, 0, 0)')
    .run(id, id, email);
}
