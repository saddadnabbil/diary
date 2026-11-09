-- Diary entries, synced per user. The primary key includes user_id so a client-chosen
-- entry id can never collide with (or overwrite) another user's row.
create table entries (
  user_id     text    not null references "user" ("id") on delete cascade,
  id          text    not null,
  title       text    not null default '',
  body        text    not null default '',
  mood        text,
  prompt_used text,
  created_at  integer not null,
  updated_at  integer not null,
  deleted_at  integer,
  -- Per-user monotonic change counter. Clients pull "everything after seq N".
  server_seq  integer not null,
  primary key (user_id, id)
);

create index entries_user_seq on entries (user_id, server_seq);

-- Fixed-window request counters for rate limiting (see src/lib/server/rate-limit.ts).
create table rate_limit_hits (
  key          text    not null primary key,
  window_start integer not null,
  count        integer not null
);

create index rate_limit_hits_window on rate_limit_hits (window_start);
