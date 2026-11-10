-- Stories: one photo with a short caption. Plain entries keep the defaults.
alter table entries add column kind text not null default 'entry';
alter table entries add column media_id text;
