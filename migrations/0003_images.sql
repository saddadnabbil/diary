-- Index of images stored in R2 (key: "<user_id>/<image_id>"). Used for per-account quotas and ownership checks.
create table user_images (
  user_id      text    not null references "user" ("id") on delete cascade,
  id           text    not null,
  bytes        integer not null,
  content_type text    not null,
  created_at   integer not null,
  primary key (user_id, id)
);
