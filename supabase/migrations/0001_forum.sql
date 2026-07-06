-- Community forum schema — idempotent; safe to re-run.
-- Posture: RLS on everything; anon/authenticated read ONLY via the views +
-- get_feed(); ALL writes happen through the service role (API routes), which
-- also calls the two SECURITY DEFINER write functions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  kick_id       bigint unique not null,
  username      text not null,
  avatar_url    text,
  role          text not null default 'user' check (role in ('user','moderator','admin')),
  post_karma    int not null default 0,
  comment_karma int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.flairs (
  id         serial primary key,
  name       text unique not null,
  color      text not null default '#f59e0b',
  position   int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id),
  flair_id       int not null references public.flairs(id),
  title          text not null check (char_length(title) between 1 and 300),
  body           text,
  kind           text not null default 'text' check (kind in ('text','image','video','embed')),
  score          int not null default 0,
  comment_count  int not null default 0,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  removed_at     timestamptz,
  removed_by     uuid references public.profiles(id),
  removal_reason text
);

create table if not exists public.media_attachments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  kind         text not null check (kind in ('image','video','kick_clip','twitch_clip')),
  storage_path text,
  url          text,
  embed_id     text,
  width        int,
  height       int,
  duration_s   numeric,
  size_bytes   bigint,
  content_type text,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.posts(id),
  parent_id      uuid references public.comments(id),
  author_id      uuid not null references public.profiles(id),
  body           text,
  gif_url        text,
  depth          int not null default 0 check (depth between 0 and 8),
  score          int not null default 0,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  removed_at     timestamptz,
  removed_by     uuid,
  removal_reason text,
  check (body is not null or gif_url is not null)
);

create table if not exists public.votes (
  profile_id   uuid not null references public.profiles(id),
  subject_type text not null check (subject_type in ('post','comment')),
  subject_id   uuid not null,
  value        smallint not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (profile_id, subject_type, subject_id)
);

create table if not exists public.bans (
  id         serial primary key,
  profile_id uuid not null references public.profiles(id),
  issued_by  uuid not null references public.profiles(id),
  reason     text,
  expires_at timestamptz,           -- null = permanent
  created_at timestamptz not null default now(),
  lifted_at  timestamptz,
  lifted_by  uuid references public.profiles(id)
);

create table if not exists public.mod_log (
  id           bigserial primary key,
  actor_id     uuid not null,
  action       text not null,
  subject_type text,
  subject_id   text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes
create index if not exists posts_created_idx    on public.posts (created_at desc);
create index if not exists posts_flair_idx      on public.posts (flair_id, created_at desc);
create index if not exists comments_post_idx    on public.comments (post_id, parent_id);
create index if not exists votes_subject_idx    on public.votes (subject_type, subject_id);
create index if not exists bans_active_idx      on public.bans (profile_id) where lifted_at is null;

-- ---------------------------------------------------------------- RLS
alter table public.profiles          enable row level security;
alter table public.flairs            enable row level security;
alter table public.posts             enable row level security;
alter table public.media_attachments enable row level security;
alter table public.comments          enable row level security;
alter table public.votes             enable row level security;
alter table public.bans              enable row level security;
alter table public.mod_log           enable row level security;

-- flairs are harmless public data: direct read allowed
drop policy if exists "flairs readable" on public.flairs;
create policy "flairs readable" on public.flairs for select using (true);
-- everything else: NO policies → anon/authenticated denied; service role bypasses.

-- ---------------------------------------------------------------- read views
-- Owned by postgres (bypasses RLS by design); they ARE the public read API.
create or replace view public.profiles_public as
  select id, kick_id, username, avatar_url, role, post_karma, comment_karma, created_at
  from public.profiles;

create or replace view public.posts_feed as
  select
    p.id, p.title, p.body, p.kind, p.score, p.comment_count,
    p.created_at, p.edited_at,
    p.flair_id, f.name as flair_name, f.color as flair_color,
    pr.username as author_username, pr.avatar_url as author_avatar,
    pr.role as author_role, pr.kick_id as author_kick_id,
    (log(greatest(abs(p.score), 1)::numeric)
      + sign(p.score::numeric)
        * extract(epoch from (p.created_at - timestamptz '2026-01-01 00:00:00+00')) / 45000.0
    )::double precision as hot_score,
    (select coalesce(
        jsonb_agg(jsonb_build_object(
          'kind', m.kind, 'url', m.url, 'storage_path', m.storage_path,
          'embed_id', m.embed_id, 'width', m.width, 'height', m.height,
          'position', m.position) order by m.position),
        '[]'::jsonb)
       from public.media_attachments m where m.post_id = p.id) as attachments
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  join public.flairs f on f.id = p.flair_id
  where p.removed_at is null;

create or replace view public.comments_thread as
  select
    c.id, c.post_id, c.parent_id, c.depth, c.score, c.created_at, c.edited_at,
    (c.removed_at is not null) as removed,
    case when c.removed_at is null then c.body end as body,
    case when c.removed_at is null then c.gif_url end as gif_url,
    case when c.removed_at is null then pr.username end as author_username,
    case when c.removed_at is null then pr.avatar_url end as author_avatar,
    case when c.removed_at is null then pr.role end as author_role
  from public.comments c
  join public.profiles pr on pr.id = c.author_id;

grant select on public.profiles_public, public.posts_feed, public.comments_thread
  to anon, authenticated;

-- ---------------------------------------------------------------- feed RPC
create or replace function public.get_feed(
  p_sort   text default 'hot',
  p_flair  int default null,
  p_cursor jsonb default null,
  p_limit  int default 25
) returns setof public.posts_feed
language sql stable set search_path = public
as $$
  select *
  from public.posts_feed
  where (p_flair is null or flair_id = p_flair)
    and (
      p_cursor is null
      or case p_sort
           when 'new' then (created_at, id) < ((p_cursor->>'k')::timestamptz, (p_cursor->>'id')::uuid)
           when 'top' then (score, id)      < ((p_cursor->>'k')::int,        (p_cursor->>'id')::uuid)
           else            (hot_score, id)  < ((p_cursor->>'k')::double precision, (p_cursor->>'id')::uuid)
         end
    )
  order by
    case p_sort
      when 'new' then extract(epoch from created_at)
      when 'top' then score::double precision
      else hot_score
    end desc,
    id desc
  limit least(greatest(p_limit, 1), 50)
$$;

grant execute on function public.get_feed(text, int, jsonb, int) to anon, authenticated;

-- ------------------------------------------------- write RPCs (service only)
create or replace function public.cast_vote(
  p_profile uuid, p_type text, p_id uuid, p_value smallint
) returns table (new_score int, my_vote smallint)
language plpgsql security definer set search_path = public
as $$
declare
  v_old    smallint := 0;
  v_delta  int;
  v_author uuid;
begin
  if p_type not in ('post','comment') then raise exception 'bad_subject'; end if;
  if p_value not in (-1, 0, 1) then raise exception 'bad_value'; end if;

  select value into v_old from votes
    where profile_id = p_profile and subject_type = p_type and subject_id = p_id;
  v_old := coalesce(v_old, 0);

  if p_value = 0 then
    delete from votes
      where profile_id = p_profile and subject_type = p_type and subject_id = p_id;
  else
    insert into votes (profile_id, subject_type, subject_id, value)
    values (p_profile, p_type, p_id, p_value)
    on conflict (profile_id, subject_type, subject_id)
      do update set value = excluded.value;
  end if;

  v_delta := p_value - v_old;

  if p_type = 'post' then
    update posts set score = score + v_delta where id = p_id
      returning author_id, score into v_author, new_score;
    if v_author is null then raise exception 'not_found'; end if;
    update profiles set post_karma = post_karma + v_delta where id = v_author;
  else
    update comments set score = score + v_delta where id = p_id
      returning author_id, score into v_author, new_score;
    if v_author is null then raise exception 'not_found'; end if;
    update profiles set comment_karma = comment_karma + v_delta where id = v_author;
  end if;

  my_vote := p_value;
  return next;
end $$;

create or replace function public.create_comment(
  p_author uuid, p_post uuid, p_parent uuid, p_body text, p_gif_url text
) returns public.comments_thread
language plpgsql security definer set search_path = public
as $$
declare
  v_depth int := 0;
  v_id    uuid;
  v_row   public.comments_thread;
begin
  if (p_body is null or length(trim(p_body)) = 0) and p_gif_url is null then
    raise exception 'empty_comment';
  end if;

  perform 1 from posts where id = p_post and removed_at is null;
  if not found then raise exception 'post_not_found'; end if;

  if p_parent is not null then
    select depth + 1 into v_depth from comments
      where id = p_parent and post_id = p_post;
    if v_depth is null then raise exception 'parent_not_found'; end if;
    if v_depth > 8 then raise exception 'max_depth'; end if;
  end if;

  insert into comments (post_id, parent_id, author_id, body, gif_url, depth)
  values (p_post, p_parent, p_author, nullif(trim(p_body), ''), p_gif_url, v_depth)
  returning id into v_id;

  update posts set comment_count = comment_count + 1 where id = p_post;

  select * into v_row from comments_thread where id = v_id;
  return v_row;
end $$;

revoke execute on function public.cast_vote(uuid, text, uuid, smallint)
  from public, anon, authenticated;
revoke execute on function public.create_comment(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------- seeds
insert into public.flairs (name, color, position) values
  ('General Discussion',      '#f59e0b', 0),
  ('RV Life',                 '#34d399', 1),
  ('Stream Discussion',       '#60a5fa', 2),
  ('Suggestions & Feedback',  '#a78bfa', 3),
  ('Clips & Media',           '#f472b6', 4),
  ('Off Topic',               '#94a3b8', 5),
  ('Announcements',           '#ef4444', 6)
on conflict (name) do nothing;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('forum-media', 'forum-media', true)
on conflict (id) do nothing;
